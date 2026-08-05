import { randomUUID } from 'node:crypto'
import {
  deleteDraftPublicFaqRow,
  getPublicFaqRowForLudo,
  insertPublicFaqAtomic,
  listPublicFaqRows,
  listVisiblePublicFaqRows,
  updatePublicFaqAtomic,
  updatePublicFaqPublicationRow,
} from '../db/public-faqs.js'
import { listActiveSiteRows } from '../db/sites.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'

export class PublicFaqServiceError extends Error {}
export type PublicFaqTargeting =
  | { targetMode: 'all'; siteIds: readonly [] }
  | { targetMode: 'explicit'; siteIds: readonly string[] }
export type PublicFaqInput = {
  question: string
  answerMarkdown: string
  category?: string | null
  sortOrder: number
} & PublicFaqTargeting
export type PublicFaqUpdateInput = Partial<
  Pick<PublicFaqInput, 'question' | 'answerMarkdown' | 'category' | 'sortOrder'>
> &
  (PublicFaqTargeting | { targetMode?: undefined; siteIds?: undefined })

export function validatePublicEditorialText(value: string, label: string, max: number) {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized || normalized.length > max)
    throw new PublicFaqServiceError(`${label} doit contenir entre 1 et ${max} caractères.`)
  return normalized
}
export function validatePublicEditorialMarkdown(value: string, label: string, max: number) {
  const normalized = validatePublicEditorialText(value, label, max)
  if (/[<>]/.test(normalized))
    throw new PublicFaqServiceError("Le HTML brut n'est pas autorisé dans le Markdown.")
  const matches = [
    ...normalized.matchAll(/\]\(\s*([^\s)]+)/g),
    ...normalized.matchAll(/\]:\s*(?:<([^>\n]*)>|(\S+))/g),
  ]
  for (const match of matches) {
    const raw = (match[1] ?? match[2]).trim()
    if (/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/i.test(raw))
      throw new PublicFaqServiceError('Le Markdown contient un lien non autorisé.')
    const url = raw.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1')
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase()
    if (scheme && !['http', 'https', 'mailto'].includes(scheme))
      throw new PublicFaqServiceError('Le Markdown contient un lien non autorisé.')
  }
  return normalized
}
export function validatePublicSortOrder(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000)
    throw new PublicFaqServiceError("L'ordre doit être un entier entre 0 et 1000000.")
  return value
}
function revision(value: number) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PublicFaqServiceError('Révision invalide.')
}
function concurrent(): never {
  throw new PublicFaqServiceError('La FAQ a été modifiée simultanément. Rechargez-la.')
}
function required<T>(row: T | undefined): T {
  if (!row) throw new PublicFaqServiceError('FAQ introuvable.')
  return row
}
export async function resolvePublicEditorialTargets(
  ludoId: string,
  mode: 'all' | 'explicit' | undefined,
  siteIds: readonly string[] | undefined,
  preserved?: readonly string[],
) {
  if (mode === undefined && siteIds === undefined && preserved) return [...preserved]
  if (mode === undefined || siteIds === undefined)
    throw new PublicFaqServiceError('Le ciblage est requis.')
  if (new Set(siteIds).size !== siteIds.length)
    throw new PublicFaqServiceError('Un lieu est ciblé plusieurs fois.')
  if (mode === 'all') {
    if (siteIds.length) throw new PublicFaqServiceError('Tous les lieux exige une liste vide.')
    return []
  }
  if (!siteIds.length) throw new PublicFaqServiceError('Le ciblage explicite exige un lieu actif.')
  await validatePublicSiteTargets(ludoId, [...siteIds])
  return [...siteIds]
}
export async function ensurePublicEditorialTargets(ludoId: string, siteIds: string[]) {
  if (!(await isPublicSiteEnabled(ludoId)))
    throw new PublicFaqServiceError('Le module public doit être activé.')
  if (siteIds.length) await validatePublicSiteTargets(ludoId, siteIds)
  else if (!(await listActiveSiteRows(ludoId)).some((site) => site.ludoId === ludoId))
    throw new PublicFaqServiceError('La publication exige un lieu actif.')
}

export const listPublicFaqsForManagement = (ludoId: string) => listPublicFaqRows(ludoId)
export async function getPublicFaq(id: string, ludoId: string) {
  return required(await getPublicFaqRowForLudo(id, ludoId))
}
export async function createPublicFaq(
  ludoId: string,
  memberId: string,
  input: PublicFaqInput,
  now = new Date(),
) {
  const siteIds = await resolvePublicEditorialTargets(ludoId, input.targetMode, input.siteIds)
  const state = createDraftPublicationState(now)
  return required(
    await insertPublicFaqAtomic(
      {
        id: randomUUID(),
        ludoId,
        question: validatePublicEditorialText(input.question, 'La question', 300),
        answerMarkdown: validatePublicEditorialMarkdown(input.answerMarkdown, 'La réponse', 20000),
        category:
          input.category == null
            ? null
            : validatePublicEditorialText(input.category, 'La catégorie', 100),
        sortOrder: validatePublicSortOrder(input.sortOrder),
        status: state.status,
        revision: 1,
        authorMemberId: memberId,
        updatedByMemberId: memberId,
        publishedByMemberId: null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      siteIds,
    ),
  )
}
export async function updatePublicFaq(
  id: string,
  ludoId: string,
  input: PublicFaqUpdateInput,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const current = await getPublicFaq(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  const siteIds = await resolvePublicEditorialTargets(
    ludoId,
    input.targetMode,
    input.siteIds,
    current.targets.map((x) => x.siteId),
  )
  const updated = await updatePublicFaqAtomic(
    id,
    ludoId,
    expectedRevision,
    {
      question:
        input.question === undefined
          ? current.question
          : validatePublicEditorialText(input.question, 'La question', 300),
      answerMarkdown:
        input.answerMarkdown === undefined
          ? current.answerMarkdown
          : validatePublicEditorialMarkdown(input.answerMarkdown, 'La réponse', 20000),
      category:
        input.category === undefined
          ? current.category
          : input.category === null
            ? null
            : validatePublicEditorialText(input.category, 'La catégorie', 100),
      sortOrder:
        input.sortOrder === undefined
          ? current.sortOrder
          : validatePublicSortOrder(input.sortOrder),
      updatedByMemberId: memberId,
      updatedAt: now,
    },
    siteIds,
  )
  if (!updated) concurrent()
  return updated
}
async function transition(
  id: string,
  ludoId: string,
  next: 'published' | 'hidden',
  memberId: string,
  expectedRevision: number,
  now: Date,
) {
  revision(expectedRevision)
  const current = await getPublicFaq(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  if (current.status === next) return { faq: current, changed: false, previousStatus: next }
  if (next === 'hidden' && current.status === 'draft')
    throw new PublicFaqServiceError('Un brouillon ne peut pas être masqué.')
  if (next === 'published')
    await ensurePublicEditorialTargets(
      ludoId,
      current.targets.map((x) => x.siteId),
    )
  const state = transitionPublicContent(current, next, now)
  const updated = await updatePublicFaqPublicationRow(
    id,
    ludoId,
    current.status,
    expectedRevision,
    {
      status: state.status,
      publishedAt: state.publishedAt,
      publishedByMemberId: current.publishedByMemberId ?? memberId,
      updatedByMemberId: memberId,
      updatedAt: now,
    },
  )
  if (!updated) concurrent()
  return { faq: await getPublicFaq(id, ludoId), changed: true, previousStatus: current.status }
}
export const publishPublicFaq = (
  id: string,
  ludoId: string,
  memberId: string,
  rev: number,
  now = new Date(),
) => transition(id, ludoId, 'published', memberId, rev, now)
export const hidePublicFaq = (
  id: string,
  ludoId: string,
  memberId: string,
  rev: number,
  now = new Date(),
) => transition(id, ludoId, 'hidden', memberId, rev, now)
export async function deleteDraftPublicFaq(id: string, ludoId: string, rev: number) {
  revision(rev)
  const current = await getPublicFaq(id, ludoId)
  if (current.status !== 'draft')
    throw new PublicFaqServiceError('Seul un brouillon peut être supprimé.')
  if (current.revision !== rev || !(await deleteDraftPublicFaqRow(id, ludoId, rev))) concurrent()
}
export async function listVisiblePublicFaqs(ludoId: string, siteId?: string, limit = 100) {
  if (!(await isPublicSiteEnabled(ludoId))) return []
  if (!Number.isSafeInteger(limit) || limit < 1) throw new PublicFaqServiceError('Limite invalide.')
  if (
    siteId &&
    !(await listActiveSiteRows(ludoId)).some((site) => site.ludoId === ludoId && site.id === siteId)
  )
    return []
  return listVisiblePublicFaqRows(ludoId, siteId, Math.min(limit, 200))
}
