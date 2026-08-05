import { createHash, randomUUID } from 'node:crypto'
import { getLudoBySlug } from '../db/ludotheques.js'
import { getPublicActivityRowForLudo } from '../db/public-activities.js'
import {
  getPublicActivityRegistrationAvailabilityRow,
  getPublicActivityRegistrationByIdempotency,
  getPublicActivityRegistrationRowForLudo,
  insertPublicActivityRegistrationAtomic,
  listPublicActivityRegistrationRows,
  transitionPublicActivityRegistrationRow,
  updatePublicActivityRegistrationSettingsRow,
} from '../db/public-activity-registrations.js'
import type { PublicActivityRegistrationStatus } from '../schema.js'
import { emitAuditEvent } from './events.js'
import { getVisiblePublicActivityBySlug } from './public-activities.js'
import { isPublicSiteEnabled } from './public-site.js'

export const ACTIVITY_WAITLIST_MESSAGE = 'Nous vous contacterons si une place se libère.'
export const ACTIVITY_RECEIPT_MESSAGE = 'Votre inscription a bien été reçue.'

export class PublicActivityRegistrationServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid' | 'not_found' | 'conflict' = 'invalid',
  ) {
    super(message)
  }
}

export type PublicActivityRegistrationInput = {
  contactName: string
  email: string
  phone?: string | null
  participantCount: number
  message?: string | null
}

function requiredText(value: unknown, label: string, max: number) {
  if (typeof value !== 'string')
    throw new PublicActivityRegistrationServiceError(`${label} invalide.`)
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  const forbiddenControl = [...normalized].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 && code !== 9 && code !== 10
  })
  if (!normalized || normalized.length > max || forbiddenControl)
    throw new PublicActivityRegistrationServiceError(`${label} invalide.`)
  return normalized
}

function optionalText(value: unknown, label: string, max: number) {
  return value == null || value === '' ? null : requiredText(value, label, max)
}

function idempotencyHash(key: string) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 200 || !/^[\x21-\x7e]+$/.test(key))
    throw new PublicActivityRegistrationServiceError("Clé d'idempotence invalide.")
  return createHash('sha256').update(key).digest('hex')
}

function normalizedActivitySlug(value: string) {
  if (typeof value !== 'string')
    throw new PublicActivityRegistrationServiceError("Slug d'activité invalide.")
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug || slug.length > 120)
    throw new PublicActivityRegistrationServiceError("Slug d'activité invalide.")
  return slug
}

function cleanInput(input: PublicActivityRegistrationInput) {
  const email = requiredText(input.email, "L'e-mail", 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new PublicActivityRegistrationServiceError("L'e-mail est invalide.")
  if (
    !Number.isSafeInteger(input.participantCount) ||
    input.participantCount < 1 ||
    input.participantCount > 50
  )
    throw new PublicActivityRegistrationServiceError('Le nombre de participants est invalide.')
  return {
    contactName: requiredText(input.contactName, 'Le nom', 160),
    email,
    phone: optionalText(input.phone, 'Le téléphone', 50),
    participantCount: input.participantCount,
    message: optionalText(input.message, 'Le message', 2000),
  }
}

function requestFingerprint(activitySlug: string, input: ReturnType<typeof cleanInput>) {
  const canonical = JSON.stringify({ activitySlug, ...input })
  return createHash('sha256').update(canonical).digest('hex')
}

function replay(
  existing: {
    id: string
    requestFingerprint: string
    receiptStatus: PublicActivityRegistrationStatus
  },
  fingerprint: string,
) {
  if (existing.requestFingerprint !== fingerprint)
    throw new PublicActivityRegistrationServiceError(
      "Cette clé d'idempotence correspond à une autre demande.",
      'conflict',
    )
  if (existing.receiptStatus !== 'received' && existing.receiptStatus !== 'waitlisted')
    throw new Error("Statut de reçu d'inscription invariant invalide.")
  return {
    receiptId: existing.id,
    status: existing.receiptStatus,
    message: receipt(existing.receiptStatus),
    created: false,
  }
}

function receipt(status: PublicActivityRegistrationStatus) {
  return status === 'waitlisted' ? ACTIVITY_WAITLIST_MESSAGE : ACTIVITY_RECEIPT_MESSAGE
}

export async function submitPublicActivityRegistrationByLudoSlug(
  ludoSlug: string,
  activitySlug: string,
  key: string,
  input: PublicActivityRegistrationInput,
  now = new Date(),
) {
  const ludo = await getLudoBySlug(ludoSlug)
  if (!ludo) throw new PublicActivityRegistrationServiceError('Activité introuvable.', 'not_found')
  const hash = idempotencyHash(key)
  const clean = cleanInput(input)
  const normalizedSlug = normalizedActivitySlug(activitySlug)
  const fingerprint = requestFingerprint(normalizedSlug, clean)
  const existing = await getPublicActivityRegistrationByIdempotency(ludo.id, hash)
  if (existing) return replay(existing, fingerprint)

  if (!(await isPublicSiteEnabled(ludo.id)))
    throw new PublicActivityRegistrationServiceError('Activité introuvable.', 'not_found')
  const activity = await getVisiblePublicActivityBySlug(ludo.id, normalizedSlug)
  if (!activity || activity.lifecycle !== 'active' || !activity.registrationEnabled)
    throw new PublicActivityRegistrationServiceError('Activité introuvable.', 'not_found')

  const inserted = await insertPublicActivityRegistrationAtomic({
    id: randomUUID(),
    ludoId: ludo.id,
    activityId: activity.id,
    idempotencyKeyHash: hash,
    requestFingerprint: fingerprint,
    ...clean,
    createdAt: now,
    updatedAt: now,
  })
  if (inserted)
    return {
      receiptId: inserted.id,
      status: inserted.receipt_status,
      message: receipt(inserted.receipt_status),
      created: true,
    }

  const raced = await getPublicActivityRegistrationByIdempotency(ludo.id, hash)
  if (raced) return replay(raced, fingerprint)
  throw new PublicActivityRegistrationServiceError('Activité introuvable.', 'not_found')
}

export async function getPublicActivityRegistrationAvailability(
  activityId: string,
  ludoId: string,
) {
  const row = await getPublicActivityRegistrationAvailabilityRow(activityId, ludoId)
  if (!row || !row.enabled)
    return { enabled: false, capacity: null, isAtCapacity: false, fullMessage: null }
  const isAtCapacity = row.capacity !== null && row.occupied >= row.capacity
  return {
    enabled: true,
    capacity: row.capacity,
    isAtCapacity,
    fullMessage: isAtCapacity ? ACTIVITY_WAITLIST_MESSAGE : null,
  }
}

type ManagementRegistrationRow = NonNullable<
  Awaited<ReturnType<typeof getPublicActivityRegistrationRowForLudo>>
>

function managementDto(row: ManagementRegistrationRow) {
  return {
    id: row.id,
    activityId: row.activityId,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    participantCount: row.participantCount,
    message: row.message,
    status: row.status,
    revision: row.revision,
    handledAt: row.handledAt,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    activity: { id: row.activity.id, title: row.activity.title, slug: row.activity.slug },
  }
}

function settingsDto(activity: {
  id: string
  revision: number
  registrationEnabled: boolean
  registrationCapacity: number | null
}) {
  return {
    id: activity.id,
    revision: activity.revision,
    registrationEnabled: activity.registrationEnabled,
    registrationCapacity: activity.registrationCapacity,
  }
}

export const listPublicActivityRegistrationsForManagement = async (
  ludoId: string,
  status?: PublicActivityRegistrationStatus,
  activityId?: string,
  limit = 100,
) => {
  const rows = await listPublicActivityRegistrationRows(
    ludoId,
    status,
    activityId,
    Math.min(Math.max(limit, 1), 200),
  )
  return rows.map(managementDto)
}

export async function getPublicActivityRegistration(id: string, ludoId: string) {
  const row = await getPublicActivityRegistrationRowForLudo(id, ludoId)
  if (!row)
    throw new PublicActivityRegistrationServiceError('Inscription introuvable.', 'not_found')
  return managementDto(row)
}

function validRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PublicActivityRegistrationServiceError('Révision invalide.')
}

export async function transitionPublicActivityRegistration(
  id: string,
  ludoId: string,
  next: PublicActivityRegistrationStatus,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  validRevision(expectedRevision)
  const current = await getPublicActivityRegistration(id, ludoId)
  if (current.revision !== expectedRevision)
    throw new PublicActivityRegistrationServiceError(
      'Inscription modifiée simultanément.',
      'conflict',
    )
  if (current.status === next) return { registration: current, changed: false }
  const updated = await transitionPublicActivityRegistrationRow(
    id,
    ludoId,
    current.status,
    expectedRevision,
    {
      status: next,
      handledByMemberId: memberId,
      handledAt: now,
      archivedAt: next === 'archived' ? now : null,
      updatedAt: now,
    },
  )
  if (!updated)
    throw new PublicActivityRegistrationServiceError(
      'Inscription modifiée simultanément.',
      'conflict',
    )
  await emitAuditEvent({
    action: 'public_activity_registration.status_changed',
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'public_activity_registration',
    entityId: id,
    metadata: { from: current.status, to: next },
  })
  return { registration: await getPublicActivityRegistration(id, ludoId), changed: true }
}

export async function updatePublicActivityRegistrationSettings(
  activityId: string,
  ludoId: string,
  memberId: string,
  input: { enabled: boolean; capacity: number | null },
  expectedRevision: number,
  now = new Date(),
) {
  validRevision(expectedRevision)
  if (typeof input.enabled !== 'boolean')
    throw new PublicActivityRegistrationServiceError("Activation d'inscription invalide.")
  if (
    input.capacity !== null &&
    (!Number.isSafeInteger(input.capacity) || input.capacity < 1 || input.capacity > 10_000)
  )
    throw new PublicActivityRegistrationServiceError('Capacité invalide.')
  const current = await getPublicActivityRowForLudo(activityId, ludoId)
  if (!current)
    throw new PublicActivityRegistrationServiceError('Activité introuvable.', 'not_found')
  if (current.revision !== expectedRevision)
    throw new PublicActivityRegistrationServiceError('Activité modifiée simultanément.', 'conflict')
  if (
    current.registrationEnabled === input.enabled &&
    current.registrationCapacity === input.capacity
  )
    return { activity: settingsDto(current), changed: false }
  const updated = await updatePublicActivityRegistrationSettingsRow(
    activityId,
    ludoId,
    expectedRevision,
    input.enabled,
    input.capacity,
    memberId,
    now,
  )
  if (!updated)
    throw new PublicActivityRegistrationServiceError('Activité modifiée simultanément.', 'conflict')
  await emitAuditEvent({
    action: 'public_activity.registration_settings_changed',
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'public_activity',
    entityId: activityId,
    metadata: { registrationEnabled: input.enabled, registrationCapacity: input.capacity },
  })
  const activity = await getPublicActivityRowForLudo(activityId, ludoId)
  return { activity: activity ? settingsDto(activity) : undefined, changed: true }
}
