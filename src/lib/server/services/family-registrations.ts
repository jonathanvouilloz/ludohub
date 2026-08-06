import { createHash, randomUUID } from 'node:crypto'
import { getLudoBySlug } from '../db/ludotheques.js'
import { listActiveSiteRows } from '../db/sites.js'
import {
  createFamilyDocumentAtomic,
  createFamilyRegistrationFormRow,
  getFamilyRegistrationFormForLudo,
  getFamilySubmissionReceiptByKey,
  getFamilySubmissionRowForLudo,
  getPublishedFamilyConfigRow,
  insertFamilySubmissionAtomic,
  listFamilyDocumentRows,
  listFamilySubmissionRows,
  processFamilySubmissionAtomic,
  publishFamilyFormAtomic,
  purgeDueFamilySubmissionsRow,
  recordFamilyPaymentAtomic,
  updateFamilyRegistrationFormRow,
  versionFamilyDocumentAtomic,
} from '../db/family-registrations.js'
import type {
  FamilyRegistrationDocumentKind,
  FamilyRegistrationGender,
  FamilyRegistrationPaymentMethod,
  FamilyRegistrationSubmissionStatus,
} from '../schema.js'
import { emitAuditEvent } from './events.js'

export class FamilyRegistrationServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid' | 'not_found' | 'conflict' = 'invalid',
  ) {
    super(message)
  }
}

const GENDERS = new Set<FamilyRegistrationGender>(['female', 'male', 'other', 'unspecified'])
const DOCUMENT_KINDS = new Set<FamilyRegistrationDocumentKind>([
  'rules',
  'contract',
  'privacy',
  'other',
])

function text(value: unknown, label: string, max: number, optional = false) {
  if (optional && (value == null || value === '')) return null
  if (typeof value !== 'string') throw new FamilyRegistrationServiceError(`${label} invalide.`)
  const clean = value.replace(/\r\n?/g, '\n').trim()
  if (!clean || clean.length > max || [...clean].some((c) => c.charCodeAt(0) < 32 && c !== '\n' && c !== '\t'))
    throw new FamilyRegistrationServiceError(`${label} invalide.`)
  return clean
}

function date(value: unknown, label: string) {
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : null
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    throw new FamilyRegistrationServiceError(`${label} invalide.`)
  return value
}

function revision(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new FamilyRegistrationServiceError('Révision invalide.')
  return value as number
}

function hashKey(key: string) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 200 || !/^[\x21-\x7e]+$/.test(key))
    throw new FamilyRegistrationServiceError("Clé d'idempotence invalide.")
  return createHash('sha256').update(key).digest('hex')
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export async function getPublicFamilyMembershipByLudoSlug(ludoSlug: string) {
  const ludo = await getLudoBySlug(ludoSlug)
  if (!ludo) throw new FamilyRegistrationServiceError('Formulaire introuvable.', 'not_found')
  const config = await getPublishedFamilyConfigRow(ludo.id)
  if (!config) throw new FamilyRegistrationServiceError('Formulaire introuvable.', 'not_found')
  const sites = await listActiveSiteRows(ludo.id)
  if (!sites.length) throw new FamilyRegistrationServiceError('Formulaire introuvable.', 'not_found')
  return {
    title: config.title,
    intro: config.intro,
    version: config.version,
    annualFeeCents: config.annual_fee_cents,
    currency: config.currency,
    paymentMethods: [config.allows_twint ? 'twint' : null, config.allows_cash ? 'cash' : null].filter(Boolean),
    maxMembers: config.max_members,
    consentLabel: config.consent_label,
    documents: config.documents.map((document) => ({
      slug: document.slug,
      title: document.title,
      kind: document.kind,
      requiredAcceptance: document.requiredAcceptance,
      version: document.version,
      contentMarkdown: document.contentMarkdown,
      sha256: document.sha256,
    })),
    sites: sites.map((site) => ({ id: site.id, name: site.name })),
  }
}

type PersonInput = { gender?: unknown; firstName?: unknown; lastName?: unknown; birthDate?: unknown }
export type FamilySubmissionInput = PersonInput & {
  siteId?: unknown
  address?: unknown
  postalCode?: unknown
  city?: unknown
  phone?: unknown
  secondaryPhone?: unknown
  email?: unknown
  consentAccepted?: unknown
  consentFullName?: unknown
  consentAcceptedOn?: unknown
  members?: unknown
}

function cleanPerson(input: PersonInput, label: string, sortOrder: number) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new FamilyRegistrationServiceError(`${label} invalide.`)
  const gender = input.gender ?? 'unspecified'
  if (!GENDERS.has(gender as FamilyRegistrationGender))
    throw new FamilyRegistrationServiceError(`${label} : genre invalide.`)
  return {
    id: randomUUID(),
    gender: gender as FamilyRegistrationGender,
    firstName: text(input.firstName, `${label} : prénom`, 100) as string,
    lastName: text(input.lastName, `${label} : nom`, 100) as string,
    birthDate: input.birthDate == null || input.birthDate === '' ? null : date(input.birthDate, `${label} : date de naissance`),
    sortOrder,
  }
}

export async function submitPublicFamilyMembership(
  ludoSlug: string,
  idempotencyKey: string,
  input: FamilySubmissionInput,
  now = new Date(),
) {
  const ludo = await getLudoBySlug(ludoSlug)
  if (!ludo) throw new FamilyRegistrationServiceError('Formulaire introuvable.', 'not_found')
  const keyHash = hashKey(idempotencyKey)
  if (input.siteId != null && input.siteId !== '' && typeof input.siteId !== 'string')
    throw new FamilyRegistrationServiceError('Lieu invalide.')
  const requestedSiteId = typeof input.siteId === 'string' && input.siteId ? input.siteId : null
  if (input.consentAccepted !== true)
    throw new FamilyRegistrationServiceError('Le consentement est obligatoire.')
  const rawMembers = input.members ?? []
  if (!Array.isArray(rawMembers) || rawMembers.length > 50)
    throw new FamilyRegistrationServiceError('Le nombre de membres est invalide.')
  const responsible = cleanPerson(input, 'Responsable', -1)
  const cleanPayload = {
    gender: responsible.gender,
    firstName: responsible.firstName,
    lastName: responsible.lastName,
    birthDate: responsible.birthDate,
    address: text(input.address, 'Adresse', 300) as string,
    postalCode: text(input.postalCode, 'NPA', 20) as string,
    city: text(input.city, 'Ville', 120) as string,
    phone: text(input.phone, 'Téléphone', 50) as string,
    secondaryPhone: text(input.secondaryPhone, 'Téléphone secondaire', 50, true),
    email: (text(input.email, 'E-mail', 320) as string).toLowerCase(),
    consentFullName: text(input.consentFullName, 'Nom de consentement', 200) as string,
    consentAcceptedOn: date(input.consentAcceptedOn, "Date d'acceptation"),
    members: rawMembers.map((member, index) => cleanPerson(member as PersonInput, `Membre ${index + 1}`, index)),
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanPayload.email))
    throw new FamilyRegistrationServiceError("L'e-mail est invalide.")
  // Le fingerprint ne contient ni UUID généré par le serveur ni version publiée
  // courante : une même clé doit rester rejouable après purge ou republication.
  const requestFingerprint = fingerprint({
    siteId: requestedSiteId,
    gender: cleanPayload.gender,
    firstName: cleanPayload.firstName,
    lastName: cleanPayload.lastName,
    birthDate: cleanPayload.birthDate,
    address: cleanPayload.address,
    postalCode: cleanPayload.postalCode,
    city: cleanPayload.city,
    phone: cleanPayload.phone,
    secondaryPhone: cleanPayload.secondaryPhone,
    email: cleanPayload.email,
    consentFullName: cleanPayload.consentFullName,
    consentAcceptedOn: cleanPayload.consentAcceptedOn,
    members: cleanPayload.members.map(({ gender, firstName, lastName, birthDate, sortOrder }) => ({
      gender,
      firstName,
      lastName,
      birthDate,
      sortOrder,
    })),
  })
  const existing = await getFamilySubmissionReceiptByKey(ludo.id, keyHash)
  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint)
      throw new FamilyRegistrationServiceError("Cette clé d'idempotence correspond à une autre demande.", 'conflict')
    return { receiptId: existing.receiptId, submittedAt: existing.submittedAt, created: false }
  }
  const config = await getPublishedFamilyConfigRow(ludo.id)
  if (!config) throw new FamilyRegistrationServiceError('Formulaire introuvable.', 'not_found')
  if (cleanPayload.members.length > config.max_members)
    throw new FamilyRegistrationServiceError('Le nombre de membres est invalide.')
  const sites = await listActiveSiteRows(ludo.id)
  const site = requestedSiteId ? sites.find((candidate) => candidate.id === requestedSiteId) : sites.length === 1 ? sites[0] : undefined
  if (!site) throw new FamilyRegistrationServiceError(sites.length > 1 ? 'Le lieu est obligatoire.' : 'Lieu invalide.')
  const clean = { siteId: site.id, ...cleanPayload }
  const receiptId = randomUUID()
  const inserted = await insertFamilySubmissionAtomic({
    id: receiptId,
    ludoId: ludo.id,
    formId: config.form_id,
    formVersionId: config.form_version_id,
    formVersion: config.version,
    keyHash,
    fingerprint: requestFingerprint,
    consentAcceptedAt: now,
    consentLabelSnapshot: config.consent_label,
    consentDocumentsSnapshot: config.documents,
    now,
    ...clean,
  })
  if (inserted) return { receiptId, submittedAt: now, created: true }
  const raced = await getFamilySubmissionReceiptByKey(ludo.id, keyHash)
  if (raced && raced.requestFingerprint === requestFingerprint)
    return { receiptId: raced.receiptId, submittedAt: raced.submittedAt, created: false }
  throw new FamilyRegistrationServiceError('Demande concurrente incompatible.', 'conflict')
}

export async function getFamilyFormManagement(ludoId: string) {
  const form = await getFamilyRegistrationFormForLudo(ludoId)
  if (!form) return null
  return { form, documents: await listFamilyDocumentRows(ludoId, form.id) }
}

export async function ensureFamilyForm(ludoId: string, memberId: string, now = new Date()) {
  const existing = await getFamilyRegistrationFormForLudo(ludoId)
  if (existing) return existing
  const created = await createFamilyRegistrationFormRow({ id: randomUUID(), ludoId, memberId, title: 'Adhésion familiale', now })
  if (created) return created
  const raced = await getFamilyRegistrationFormForLudo(ludoId)
  if (!raced) throw new FamilyRegistrationServiceError('Initialisation impossible.', 'conflict')
  return raced
}

export async function updateFamilyForm(ludoId: string, memberId: string, input: Record<string, unknown>, now = new Date()) {
  const form = await ensureFamilyForm(ludoId, memberId, now)
  const annualFeeCents = input.annualFeeCents
  const maxMembers = input.maxMembers
  const retentionDays = input.retentionDays
  if (!Number.isSafeInteger(annualFeeCents) || (annualFeeCents as number) < 0 || (annualFeeCents as number) > 1_000_000 ||
      !Number.isSafeInteger(maxMembers) || (maxMembers as number) < 1 || (maxMembers as number) > 50 ||
      !Number.isSafeInteger(retentionDays) || (retentionDays as number) < 1 || (retentionDays as number) > 365 ||
      typeof input.enabled !== 'boolean' || typeof input.allowsTwint !== 'boolean' || typeof input.allowsCash !== 'boolean' || (!input.allowsTwint && !input.allowsCash))
    throw new FamilyRegistrationServiceError('Configuration invalide.')
  const updated = await updateFamilyRegistrationFormRow({ id: form.id, ludoId, memberId, expectedRevision: revision(input.revision), title: text(input.title, 'Titre', 200) as string, intro: text(input.intro, 'Introduction', 5000, true), consentLabel: text(input.consentLabel, 'Consentement', 1000, true), enabled: input.enabled, maxMembers: maxMembers as number, retentionDays: retentionDays as number, annualFeeCents: annualFeeCents as number, allowsTwint: input.allowsTwint, allowsCash: input.allowsCash, now })
  if (!updated) throw new FamilyRegistrationServiceError('Configuration modifiée simultanément.', 'conflict')
  await emitAuditEvent({ action: 'family_membership.configuration_updated', actorLudoId: ludoId, actorMemberId: memberId, entityType: 'family_registration_form', entityId: form.id, metadata: { revision: updated.revision } })
  return updated
}

export async function saveFamilyDocument(ludoId: string, formId: string, memberId: string, input: Record<string, unknown>, now = new Date()) {
  if (!DOCUMENT_KINDS.has(input.kind as FamilyRegistrationDocumentKind) || typeof input.requiredAcceptance !== 'boolean')
    throw new FamilyRegistrationServiceError('Document invalide.')
  const contentMarkdown = text(input.contentMarkdown, 'Contenu', 100_000) as string
  const sortOrder = Number(input.sortOrder)
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000)
    throw new FamilyRegistrationServiceError('Ordre invalide.')
  const common = { ludoId, memberId, title: text(input.title, 'Titre', 200) as string, kind: input.kind as FamilyRegistrationDocumentKind, requiredAcceptance: input.requiredAcceptance, sortOrder, contentMarkdown, sha256: createHash('sha256').update(contentMarkdown).digest('hex'), versionId: randomUUID(), now }
  if (typeof input.id === 'string') {
    const result = await versionFamilyDocumentAtomic({ ...common, id: input.id, expectedRevision: revision(input.revision) })
    if (!result) throw new FamilyRegistrationServiceError('Document modifié simultanément.', 'conflict')
    await emitAuditEvent({ action: 'family_membership.document_versioned', actorLudoId: ludoId, actorMemberId: memberId, entityType: 'family_registration_document', entityId: input.id, metadata: { kind: common.kind, requiredAcceptance: common.requiredAcceptance } })
    return result
  }
  const slug = (text(input.slug, 'Slug', 100) as string).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!slug) throw new FamilyRegistrationServiceError('Slug invalide.')
  const id = randomUUID()
  const result = await createFamilyDocumentAtomic({ ...common, id, formId, slug })
  await emitAuditEvent({ action: 'family_membership.document_created', actorLudoId: ludoId, actorMemberId: memberId, entityType: 'family_registration_document', entityId: id, metadata: { kind: common.kind, requiredAcceptance: common.requiredAcceptance } })
  return result
}

export async function publishFamilyForm(ludoId: string, memberId: string, formId: string, expectedRevision: unknown, now = new Date()) {
  const result = await publishFamilyFormAtomic({ formId, versionId: randomUUID(), ludoId, expectedRevision: revision(expectedRevision), memberId, now })
  if (!result) throw new FamilyRegistrationServiceError('Publication impossible : consentement et document obligatoire requis, ou modification concurrente.', 'conflict')
  await emitAuditEvent({ action: 'family_membership.published', actorLudoId: ludoId, actorMemberId: memberId, entityType: 'family_registration_form', entityId: formId, metadata: { version: result.version } })
  return result
}

export async function listFamilySubmissions(ludoId: string, status?: FamilyRegistrationSubmissionStatus, limit = 100) {
  return listFamilySubmissionRows(ludoId, status, Math.min(Math.max(limit, 1), 200))
}

export async function getFamilySubmission(id: string, ludoId: string) {
  const row = await getFamilySubmissionRowForLudo(id, ludoId)
  if (!row) throw new FamilyRegistrationServiceError('Adhésion introuvable.', 'not_found')
  return row
}

export async function processFamilySubmission(id: string, ludoId: string, memberId: string, expectedRevision: unknown, now = new Date()) {
  const result = await processFamilySubmissionAtomic({ id, ludoId, memberId, expectedRevision: revision(expectedRevision), now })
  if (!result) throw new FamilyRegistrationServiceError('Adhésion modifiée simultanément.', 'conflict')
  await emitAuditEvent({ action: 'family_membership.processed', actorLudoId: ludoId, actorMemberId: memberId, entityType: 'family_registration_submission', entityId: id, metadata: {} })
  return getFamilySubmission(id, ludoId)
}

export async function recordFamilyPayment(id: string, ludoId: string, memberId: string, method: unknown, expectedRevision: unknown, now = new Date()) {
  if (method !== null && method !== 'twint' && method !== 'cash') throw new FamilyRegistrationServiceError('Paiement invalide.')
  const result = await recordFamilyPaymentAtomic({ id, ludoId, memberId, paymentMethod: method as FamilyRegistrationPaymentMethod | null, expectedRevision: revision(expectedRevision), now })
  if (!result) throw new FamilyRegistrationServiceError('Adhésion modifiée simultanément.', 'conflict')
  await emitAuditEvent({ action: 'family_membership.payment_recorded', actorLudoId: ludoId, actorMemberId: memberId, entityType: 'family_registration_submission', entityId: id, metadata: { method } })
  return getFamilySubmission(id, ludoId)
}

/** Travail borné et relançable : au plus 1 000 familles par invocation. */
export async function purgeDueFamilySubmissions(now = new Date(), batchSize = 100, maxBatches = 10) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500 || !Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > 20)
    throw new FamilyRegistrationServiceError('Paramètres de purge invalides.')
  let purged = 0
  let batches = 0
  while (batches < maxBatches) {
    const count = await purgeDueFamilySubmissionsRow(now, batchSize)
    purged += count; batches += 1
    if (count < batchSize) break
  }
  return { purged, batches, hasMore: batches === maxBatches }
}
