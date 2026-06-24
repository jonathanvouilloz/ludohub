import * as XLSX from 'xlsx'
import {
  createCampaign,
  createContact,
  deleteCampaign,
  deleteContact,
  findContactByEmail,
  getCampaignById,
  getCampaignSendStats,
  getContactById,
  getContactEmails,
  getSentContactIds,
  insertCampaignSends,
  insertContacts,
  listSubscribedContacts,
  updateCampaign,
  updateContact,
} from '../db/newsletter.js'
import { getResend, newsletterFrom } from '../resend.js'
import { emitEvent } from './events.js'
import { renderCampaignEmail, type EmailBrand, type EmailContent } from '$lib/email/template.js'
import { newsletterContactTag } from '../schema.js'
import type {
  CampaignContent,
  CampaignRow,
  CampaignSendInsert,
  LudothequeRow,
  NewsletterContactInsert,
  NewsletterContactRow,
  NewsletterContactSource,
  NewsletterContactTag,
} from '../schema.js'

/** Erreur métier (message FR destiné à l'UI responsable). */
export class NewsletterServiceError extends Error {}

/** Normalise une valeur de segment (validée contre l'enum DB) : '' / invalide → null. */
export function parseTag(value: string | undefined | null): NewsletterContactTag | null {
  const v = (value ?? '').trim()
  return (newsletterContactTag.enumValues as readonly string[]).includes(v)
    ? (v as NewsletterContactTag)
    : null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Valide + normalise un email (trim, minuscules). Lève si invalide. */
export function normalizeEmail(value: string | undefined): string {
  const email = (value ?? '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    throw new NewsletterServiceError('Adresse email invalide.')
  }
  return email
}

/** Validation souple (sans lever) — utilisée par l'import en masse. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim().toLowerCase())
}

/** Champ texte optionnel : '' → null. */
function parseOptional(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

/** Token public de désabonnement, unique par contact. */
export function generateUnsubscribeToken(): string {
  return crypto.randomUUID()
}

export interface ContactInput {
  email: string
  firstName?: string
  lastName?: string
  notes?: string
  tag?: string
}

/** Ajout manuel d'un contact (dédup insensible à la casse par ludo). */
export async function addContact(
  ludoId: string,
  input: ContactInput,
  source: NewsletterContactSource = 'manual',
): Promise<NewsletterContactRow> {
  const email = normalizeEmail(input.email)
  const existing = await findContactByEmail(ludoId, email)
  if (existing) {
    throw new NewsletterServiceError('Un contact avec cet email existe déjà.')
  }
  return createContact({
    ludoId,
    email,
    firstName: parseOptional(input.firstName),
    lastName: parseOptional(input.lastName),
    notes: parseOptional(input.notes),
    tag: parseTag(input.tag),
    source,
    unsubscribeToken: generateUnsubscribeToken(),
  })
}

export interface ContactEditInput {
  email: string
  firstName?: string
  lastName?: string
  notes?: string
  status?: string
  tag?: string
}

const EDITABLE_STATUSES = new Set(['subscribed', 'unsubscribed', 'bounced'])

/** Édition d'un contact existant (responsable). */
export async function editContact(
  id: string,
  ludoId: string,
  input: ContactEditInput,
): Promise<NewsletterContactRow> {
  const current = await getContactById(id, ludoId)
  if (!current) throw new NewsletterServiceError('Contact introuvable.')

  const email = normalizeEmail(input.email)
  // Si l'email change, vérifier qu'il n'entre pas en collision avec un autre contact.
  if (email !== current.email.toLowerCase()) {
    const clash = await findContactByEmail(ludoId, email)
    if (clash && clash.id !== id) {
      throw new NewsletterServiceError('Un autre contact utilise déjà cet email.')
    }
  }

  const status = input.status
  if (status && !EDITABLE_STATUSES.has(status)) {
    throw new NewsletterServiceError('Statut invalide.')
  }

  const row = await updateContact(id, ludoId, {
    email,
    firstName: parseOptional(input.firstName),
    lastName: parseOptional(input.lastName),
    notes: parseOptional(input.notes),
    tag: parseTag(input.tag),
    ...(status ? { status: status as NewsletterContactRow['status'] } : {}),
  })
  if (!row) throw new NewsletterServiceError('Contact introuvable.')
  return row
}

export async function removeContact(id: string, ludoId: string): Promise<void> {
  const ok = await deleteContact(id, ludoId)
  if (!ok) throw new NewsletterServiceError('Contact introuvable.')
}

/** (Dés)abonnement rapide d'un contact depuis la liste (responsable). */
export async function setContactSubscription(
  id: string,
  ludoId: string,
  subscribed: boolean,
): Promise<void> {
  const row = await updateContact(id, ludoId, {
    status: subscribed ? 'subscribed' : 'unsubscribed',
  })
  if (!row) throw new NewsletterServiceError('Contact introuvable.')
}

/**
 * Anonymisation RGPD (droit à l'effacement) : on neutralise les données
 * personnelles tout en **gardant la ligne** (l'id reste référencé par
 * `campaign_sends`, ce qui préserve les statistiques d'envoi). L'email — `notNull`
 * et unique par ludo — est remplacé par un placeholder unique, pas par `null`.
 */
export async function anonymizeContact(id: string, ludoId: string): Promise<void> {
  const current = await getContactById(id, ludoId)
  if (!current) throw new NewsletterServiceError('Contact introuvable.')
  const row = await updateContact(id, ludoId, {
    email: `anonyme-${id}@anonyme.invalid`,
    firstName: null,
    lastName: null,
    notes: null,
    status: 'unsubscribed',
  })
  if (!row) throw new NewsletterServiceError('Contact introuvable.')
}

/** Statistiques d'envoi d'une campagne (garde tenant via getCampaignById). */
export async function getCampaignStats(
  campaignId: string,
  ludoId: string,
): Promise<{ sent: number; failed: number; bounced: number }> {
  const campaign = await getCampaignById(campaignId, ludoId)
  if (!campaign) throw new NewsletterServiceError('Campagne introuvable.')
  return getCampaignSendStats(campaignId)
}

// ─── Import CSV / Excel ──────────────────────────────────────────────────────

export interface ParsedFile {
  headers: string[]
  rows: string[][]
}

const MAX_IMPORT_ROWS = 10000

/** Décode un buffer en texte, avec repli latin1 (Excel FR exporte souvent en windows-1252). */
function decodeBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  if (utf8.includes('�')) {
    return new TextDecoder('windows-1252', { fatal: false }).decode(bytes)
  }
  return utf8
}

/** Devine le séparateur d'après la ligne d'en-tête (`;` fréquent en Suisse/FR). */
function detectDelimiter(line: string): string {
  const candidates = [';', ',', '\t']
  let best = ','
  let bestCount = -1
  for (const d of candidates) {
    const count = line.split(d).length - 1
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

/** Découpe une ligne CSV en gérant les champs entre guillemets et les `""` échappés. */
function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function toHeadersRows(matrix: string[][]): ParsedFile {
  const cleaned = matrix.filter((r) => r.some((c) => c.trim() !== ''))
  if (cleaned.length === 0) throw new NewsletterServiceError('Le fichier est vide.')
  const [headerRow, ...rest] = cleaned
  const headers = headerRow.map((h, i) => h.trim() || `Colonne ${i + 1}`)
  const rows = rest.slice(0, MAX_IMPORT_ROWS).map((r) => headers.map((_, i) => (r[i] ?? '').trim()))
  return { headers, rows }
}

function parseCsv(buf: ArrayBuffer): ParsedFile {
  const text = decodeBuffer(buf).replace(/^\uFEFF/, '')
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '')
  if (lines.length === 0) throw new NewsletterServiceError('Le fichier est vide.')
  const delimiter = detectDelimiter(lines[0])
  return toHeadersRows(lines.map((line) => parseCsvLine(line, delimiter)))
}

function parseXlsx(buf: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined
  if (!sheet) throw new NewsletterServiceError('Le classeur Excel ne contient aucune feuille.')
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  })
  return toHeadersRows(matrix.map((r) => r.map((c) => String(c ?? ''))))
}

/** Parse un fichier CSV ou Excel en { en-têtes, lignes } pour l'écran de mapping. */
export async function parseContactsFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer()
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseXlsx(buf)
  return parseCsv(buf)
}

export interface ImportMapping {
  email: number
  firstName?: number | null
  lastName?: number | null
}

export interface ImportResult {
  added: number
  invalid: number
  duplicates: number
}

function pick(row: string[], idx: number | null | undefined): string | null {
  if (idx == null || idx < 0) return null
  const v = (row[idx] ?? '').trim()
  return v ? v : null
}

/**
 * Importe des lignes parsées selon le mapping de colonnes. Dédup insensible à la
 * casse contre les contacts existants ET au sein du fichier, skip des emails
 * invalides. `source = 'import'`.
 */
export async function importContacts(
  ludoId: string,
  mapping: ImportMapping,
  rows: string[][],
  tag?: string,
): Promise<ImportResult> {
  if (mapping?.email == null || mapping.email < 0) {
    throw new NewsletterServiceError('Veuillez indiquer la colonne contenant les emails.')
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new NewsletterServiceError('Aucune ligne à importer.')
  }

  const importTag = parseTag(tag)
  const existing = await getContactEmails(ludoId)
  const seen = new Set<string>()
  let invalid = 0
  let duplicates = 0
  const toInsert: NewsletterContactInsert[] = []

  for (const row of rows) {
    const email = (row[mapping.email] ?? '').trim().toLowerCase()
    if (!email || !isValidEmail(email)) {
      invalid++
      continue
    }
    if (existing.has(email) || seen.has(email)) {
      duplicates++
      continue
    }
    seen.add(email)
    toInsert.push({
      ludoId,
      email,
      firstName: pick(row, mapping.firstName),
      lastName: pick(row, mapping.lastName),
      tag: importTag,
      source: 'import',
      unsubscribeToken: generateUnsubscribeToken(),
    })
  }

  const added = await insertContacts(toInsert)
  // L'index unique peut écarter des collisions concurrentes : recompter en doublons.
  duplicates += toInsert.length - added
  return { added, invalid, duplicates }
}

// ─── Campagnes (brouillon) ───────────────────────────────────────────────────

const EMPTY_CONTENT: CampaignContent = { body: '' }

export async function createDraftCampaign(ludoId: string): Promise<CampaignRow> {
  return createCampaign({ ludoId, subject: 'Nouvelle campagne', content: EMPTY_CONTENT })
}

export interface DraftSaveInput {
  subject: string
  previewText?: string | null
  content: CampaignContent
  targetTag?: string | null
}

export async function saveDraft(
  campaignId: string,
  ludoId: string,
  input: DraftSaveInput,
): Promise<CampaignRow> {
  const existing = await getCampaignById(campaignId, ludoId)
  if (!existing) throw new NewsletterServiceError('Campagne introuvable.')
  if (existing.status === 'sent') {
    throw new NewsletterServiceError('Une campagne envoyée ne peut plus être modifiée.')
  }
  const row = await updateCampaign(campaignId, ludoId, {
    subject: input.subject.trim() || 'Sans objet',
    previewText: input.previewText?.trim() || null,
    content: input.content,
    targetTag: parseTag(input.targetTag),
  })
  if (!row) throw new NewsletterServiceError('Campagne introuvable.')
  return row
}

export async function removeCampaign(id: string, ludoId: string): Promise<void> {
  const ok = await deleteCampaign(id, ludoId)
  if (!ok) throw new NewsletterServiceError('Campagne introuvable.')
}

/** Parse le champ `content` (JSON) d'un formulaire éditeur en `CampaignContent`. */
export function parseContentField(raw: string | undefined): CampaignContent {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw || '{}')
  } catch {
    throw new NewsletterServiceError('Contenu de campagne illisible.')
  }
  const obj = (parsed ?? {}) as Record<string, unknown>
  const str = (v: unknown): string | undefined => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s ? s : undefined
  }
  return {
    title: str(obj.title),
    body: typeof obj.body === 'string' ? obj.body : '',
    imageUrl: str(obj.imageUrl),
    ctaLabel: str(obj.ctaLabel),
    ctaUrl: str(obj.ctaUrl),
    pdfUrl: str(obj.pdfUrl),
    pdfAsAttachment: obj.pdfAsAttachment === true || obj.pdfAsAttachment === 'true',
  }
}

// ─── Envoi (Resend) ──────────────────────────────────────────────────────────

export interface CampaignDraft {
  subject: string
  previewText?: string | null
  content: CampaignContent
  targetTag?: string | null
}

function brandFromLudo(ludo: LudothequeRow): EmailBrand {
  return {
    name: ludo.name,
    color: ludo.color,
    logoUrl: ludo.logoUrl,
    address: ludo.address,
    email: ludo.email,
    phone: ludo.phone,
    website: ludo.website,
  }
}

/** Adresse `From` : nom de la ludo (nettoyé) sur le domaine vérifié partagé. */
function fromAddress(ludo: LudothequeRow): string {
  const safe = ludo.name.replace(/["<>\r\n]/g, '').trim() || 'Ludothèque'
  return `${safe} <${newsletterFrom()}>`
}

function unsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/unsubscribe?token=${encodeURIComponent(token)}`
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Extrait les ids Resend d'une réponse batch (forme défensive selon SDK). */
function extractBatchIds(data: unknown): (string | null)[] {
  const d = data as { data?: { id?: string }[] } | { id?: string }[] | null
  const list = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []
  return list.map((x) => x?.id ?? null)
}

/** Envoie un email de test (aucune écriture en base, objet préfixé « [Test] »). */
export async function sendTestEmail(
  ludo: LudothequeRow,
  draft: CampaignDraft,
  toEmail: string,
  baseUrl: string,
): Promise<void> {
  const to = normalizeEmail(toEmail)
  const subject = draft.subject?.trim()
  if (!subject) throw new NewsletterServiceError("L'objet de la campagne est requis.")
  if (!draft.content?.body?.trim()) {
    throw new NewsletterServiceError("Ajoutez du contenu avant d'envoyer un test.")
  }

  const html = renderCampaignEmail(draft.content as EmailContent, brandFromLudo(ludo), {
    unsubscribeUrl: unsubscribeUrl(baseUrl, 'apercu'),
    previewText: draft.previewText,
    recipientFirstName: null,
  })

  const { error } = await getResend().emails.send({
    from: fromAddress(ludo),
    to: [to],
    replyTo: ludo.email ?? undefined,
    subject: `[Test] ${subject}`,
    html,
  })
  if (error) throw new NewsletterServiceError(`Échec de l'envoi du test : ${error.message}`)
}

/**
 * Envoie une campagne à tous les contacts `subscribed` (exclut unsub/bounced et
 * ceux déjà destinataires). Idempotent : refuse une campagne déjà `sent`. Envoi
 * par lots de 100 (Resend batch), traçage dans `campaign_sends`, en-têtes
 * `List-Unsubscribe` one-click, puis `emitEvent` pour les responsables.
 */
export async function sendCampaign(
  campaignId: string,
  ludo: LudothequeRow,
  baseUrl: string,
): Promise<{ sent: number; failed: number }> {
  const campaign = await getCampaignById(campaignId, ludo.id)
  if (!campaign) throw new NewsletterServiceError('Campagne introuvable.')
  if (campaign.status === 'sent') {
    throw new NewsletterServiceError('Cette campagne a déjà été envoyée.')
  }
  const content = campaign.content
  if (!content?.body?.trim()) {
    throw new NewsletterServiceError('Le contenu de la campagne est vide.')
  }
  if (!campaign.subject?.trim()) {
    throw new NewsletterServiceError("L'objet de la campagne est requis.")
  }

  const contacts = await listSubscribedContacts(ludo.id, campaign.targetTag ?? undefined)
  const alreadySent = await getSentContactIds(campaignId)
  const recipients = contacts.filter((c) => !alreadySent.has(c.id))
  if (recipients.length === 0) {
    throw new NewsletterServiceError('Aucun destinataire abonné à contacter.')
  }

  const resend = getResend()
  const from = fromAddress(ludo)
  const brand = brandFromLudo(ludo)
  const replyTo = ludo.email ?? undefined

  let sent = 0
  let failed = 0
  const sendRows: CampaignSendInsert[] = []

  for (const group of chunk(recipients, 100)) {
    const payloads = group.map((c) => {
      const url = unsubscribeUrl(baseUrl, c.unsubscribeToken)
      return {
        from,
        to: [c.email],
        replyTo,
        subject: campaign.subject,
        html: renderCampaignEmail(content as EmailContent, brand, {
          unsubscribeUrl: url,
          previewText: campaign.previewText,
          recipientFirstName: c.firstName,
        }),
        headers: {
          'List-Unsubscribe': `<${url}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }
    })

    try {
      const { data, error } = await resend.batch.send(payloads)
      if (error) throw new Error(error.message)
      const ids = extractBatchIds(data)
      group.forEach((c, i) => {
        sendRows.push({ campaignId, contactId: c.id, status: 'sent', resendId: ids[i] ?? null })
        sent++
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec d'envoi"
      for (const c of group) {
        sendRows.push({ campaignId, contactId: c.id, status: 'failed', error: message })
        failed++
      }
    }
  }

  await insertCampaignSends(sendRows)
  await updateCampaign(campaignId, ludo.id, {
    status: 'sent',
    sentAt: new Date(),
    recipientCount: sent,
  })

  const segmentSuffix = campaign.targetTag ? ` (segment : ${campaign.targetTag})` : ''
  await emitEvent({
    type: 'campaign_sent',
    actorLudoId: ludo.id,
    entityType: 'campaign',
    entityId: campaignId,
    title: 'Newsletter envoyée',
    body: `« ${campaign.subject} » envoyée à ${sent} contact${sent > 1 ? 's' : ''}${segmentSuffix}.`,
    recipientResponsablesOf: ludo.id,
  })

  return { sent, failed }
}
