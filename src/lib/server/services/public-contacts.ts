import { createHash, randomUUID } from 'node:crypto'
import { getLudoBySlug } from '../db/ludotheques.js'
import {
  getPublicContactByIdempotency,
  getPublicContactRowForLudo,
  insertPublicContactRow,
  listPublicContactRows,
  transitionPublicContactRow,
} from '../db/public-contacts.js'
import type { PublicContactRecipient, PublicContactStatus } from '../schema.js'
import { isPublicSiteEnabled } from './public-site.js'
export class PublicContactServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid' | 'not_found' | 'conflict' = 'invalid',
  ) {
    super(message)
  }
}
export type PublicContactInput = {
  recipient: PublicContactRecipient
  name: string
  email: string
  phone?: string | null
  subject: string
  message: string
}
function text(v: unknown, l: string, max: number) {
  if (typeof v !== 'string') throw new PublicContactServiceError(`${l} invalide.`)
  const n = v.replace(/\r\n?/g, '\n').trim()
  const hasForbiddenControl = [...n].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 && code !== 9 && code !== 10
  })
  if (!n || n.length > max || hasForbiddenControl)
    throw new PublicContactServiceError(`${l} invalide.`)
  return n
}
function optional(v: unknown, l: string, max: number) {
  return v == null || v === '' ? null : text(v, l, max)
}
function keyHash(key: string) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 200 || !/^[\x21-\x7e]+$/.test(key))
    throw new PublicContactServiceError("Clé d'idempotence invalide.")
  return createHash('sha256').update(key).digest('hex')
}
function validate(i: PublicContactInput) {
  if (!['paquis', 'secheron', 'general'].includes(i.recipient))
    throw new PublicContactServiceError('Destinataire invalide.')
  const email = text(i.email, "L'e-mail", 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new PublicContactServiceError("L'e-mail est invalide.")
  return {
    recipient: i.recipient,
    name: text(i.name, 'Le nom', 160),
    email,
    phone: optional(i.phone, 'Le téléphone', 50),
    subject: text(i.subject, 'Le sujet', 200),
    message: text(i.message, 'Le message', 5000),
  }
}
export async function submitPublicContactByLudoSlug(
  slug: string,
  key: string,
  input: PublicContactInput,
  now = new Date(),
) {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id)))
    throw new PublicContactServiceError('Destinataire introuvable.', 'not_found')
  const hash = keyHash(key),
    existing = await getPublicContactByIdempotency(ludo.id, hash)
  if (existing) return { receiptId: existing.id, created: false }
  const clean = validate(input)
  try {
    const row = await insertPublicContactRow({
      id: randomUUID(),
      ludoId: ludo.id,
      idempotencyKeyHash: hash,
      ...clean,
      status: 'new',
      revision: 1,
      handledByMemberId: null,
      processedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    return { receiptId: row.id, created: true }
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === '23505') {
      const raced = await getPublicContactByIdempotency(ludo.id, hash)
      if (raced) return { receiptId: raced.id, created: false }
    }
    throw e
  }
}
export const listPublicContactsForInbox = (
  l: string,
  status: PublicContactStatus | undefined,
  limit = 100,
) => listPublicContactRows(l, status, Math.min(Math.max(limit, 1), 200))
export const listPublicContactsForManagement = listPublicContactsForInbox
export async function getPublicContact(id: string, l: string) {
  const row = await getPublicContactRowForLudo(id, l)
  if (!row) throw new PublicContactServiceError('Message introuvable.', 'not_found')
  return row
}
function rev(v: number) {
  if (!Number.isSafeInteger(v) || v < 1) throw new PublicContactServiceError('Révision invalide.')
}
export async function transitionPublicContact(
  id: string,
  l: string,
  next: PublicContactStatus,
  memberId: string,
  r: number,
  now = new Date(),
) {
  rev(r)
  const c = await getPublicContact(id, l)
  if (c.revision !== r)
    throw new PublicContactServiceError('Message modifié simultanément.', 'conflict')
  if (c.status === next) return { message: c, changed: false }
  let processedAt = c.processedAt
  let archivedAt: Date | null
  if (next === 'new') {
    processedAt = null
    archivedAt = null
  } else if (next === 'processed') {
    processedAt = c.processedAt ?? now
    archivedAt = null
  } else archivedAt = now
  const u = await transitionPublicContactRow(id, l, c.status, r, {
    status: next,
    handledByMemberId: memberId,
    processedAt,
    archivedAt,
    updatedAt: now,
  })
  if (!u) throw new PublicContactServiceError('Message modifié simultanément.', 'conflict')
  return { message: await getPublicContact(id, l), changed: true }
}
