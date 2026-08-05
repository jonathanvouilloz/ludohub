import { randomUUID } from 'node:crypto'
import {
  deleteDraftPublicGalleryRow,
  getPublicGalleryRowForLudo,
  insertPublicGalleryAtomic,
  listPublicGalleryRows,
  listVisiblePublicGalleryRows,
  updatePublicGalleryAtomic,
  updatePublicGalleryFileRow,
  updatePublicGalleryPublicationRow,
} from '../db/public-gallery.js'
import { listActiveSiteRows } from '../db/sites.js'
import type { StoredBlob } from '../media/blob-storage.js'
import {
  createAuthorizedMediaScope,
  parseManagedPublicSitePath,
  type AuthorizedMediaScope,
} from '../media/paths.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import {
  ensurePublicEditorialTargets,
  PublicFaqServiceError,
  type PublicFaqTargeting,
  resolvePublicEditorialTargets,
  validatePublicEditorialText,
  validatePublicSortOrder,
} from './public-faqs.js'
import { isPublicSiteEnabled } from './public-site.js'
export class PublicGalleryServiceError extends Error {}
export type PublicGalleryInput = {
  caption?: string | null
  alt?: string | null
  sortOrder: number
} & PublicFaqTargeting
export type PublicGalleryUpdateInput = Partial<
  Pick<PublicGalleryInput, 'caption' | 'alt' | 'sortOrder'>
> &
  (PublicFaqTargeting | { targetMode?: undefined; siteIds?: undefined })
const MAX = 8 * 1024 * 1024,
  TYPES = ['image/jpeg', 'image/png', 'image/webp']
function translate(e: unknown): never {
  if (e instanceof PublicFaqServiceError) throw new PublicGalleryServiceError(e.message)
  throw e
}
function text(v: string, l: string, m: number) {
  try {
    return validatePublicEditorialText(v, l, m)
  } catch (e) {
    translate(e)
  }
}
function optional(v: string | null | undefined, l: string, m: number) {
  return v == null ? null : text(v, l, m)
}
function order(v: number) {
  try {
    return validatePublicSortOrder(v)
  } catch (e) {
    translate(e)
  }
}
async function targets(
  l: string,
  m: 'all' | 'explicit' | undefined,
  s: readonly string[] | undefined,
  p?: readonly string[],
) {
  try {
    return await resolvePublicEditorialTargets(l, m, s, p)
  } catch (e) {
    translate(e)
  }
}
async function publishable(l: string, s: string[]) {
  try {
    await ensurePublicEditorialTargets(l, s)
  } catch (e) {
    translate(e)
  }
}
function rev(v: number) {
  if (!Number.isSafeInteger(v) || v < 1) throw new PublicGalleryServiceError('Révision invalide.')
}
function concurrent(): never {
  throw new PublicGalleryServiceError('La galerie a été modifiée simultanément. Rechargez-la.')
}
function required<T>(v: T | undefined): T {
  if (!v) throw new PublicGalleryServiceError('Image introuvable.')
  return v
}
export const listPublicGalleryForManagement = (l: string) => listPublicGalleryRows(l)
export async function getPublicGalleryImage(id: string, l: string) {
  return required(await getPublicGalleryRowForLudo(id, l))
}
export async function createPublicGalleryImage(
  l: string,
  m: string,
  input: PublicGalleryInput,
  now = new Date(),
) {
  const siteIds = await targets(l, input.targetMode, input.siteIds),
    state = createDraftPublicationState(now)
  return required(
    await insertPublicGalleryAtomic(
      {
        id: randomUUID(),
        ludoId: l,
        caption: optional(input.caption, 'La légende', 500),
        alt: optional(input.alt, 'Le texte alternatif', 300),
        sortOrder: order(input.sortOrder),
        imageUrl: null,
        imageStorageKey: null,
        status: state.status,
        revision: 1,
        authorMemberId: m,
        updatedByMemberId: m,
        publishedByMemberId: null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      siteIds,
    ),
  )
}
export async function updatePublicGalleryImage(
  id: string,
  l: string,
  input: PublicGalleryUpdateInput,
  m: string,
  expected: number,
  now = new Date(),
) {
  rev(expected)
  const current = await getPublicGalleryImage(id, l)
  if (current.revision !== expected) concurrent()
  const alt =
    input.alt === undefined ? current.alt : optional(input.alt, 'Le texte alternatif', 300)
  if (current.status !== 'draft' && !alt)
    throw new PublicGalleryServiceError('Le texte alternatif est requis.')
  const siteIds = await targets(
    l,
    input.targetMode,
    input.siteIds,
    current.targets.map((x) => x.siteId),
  )
  const updated = await updatePublicGalleryAtomic(
    id,
    l,
    expected,
    {
      caption:
        input.caption === undefined ? current.caption : optional(input.caption, 'La légende', 500),
      alt,
      sortOrder: input.sortOrder === undefined ? current.sortOrder : order(input.sortOrder),
      imageUrl: current.imageUrl,
      imageStorageKey: current.imageStorageKey,
      updatedByMemberId: m,
      updatedAt: now,
    },
    siteIds,
  )
  if (!updated) concurrent()
  return updated
}
async function transition(
  id: string,
  l: string,
  next: 'published' | 'hidden',
  m: string,
  expected: number,
  now: Date,
) {
  rev(expected)
  const current = await getPublicGalleryImage(id, l)
  if (current.revision !== expected) concurrent()
  if (current.status === next) return { image: current, changed: false, previousStatus: next }
  if (next === 'hidden' && current.status === 'draft')
    throw new PublicGalleryServiceError('Un brouillon ne peut pas être masqué.')
  if (next === 'published') {
    if (!current.imageStorageKey || !current.alt)
      throw new PublicGalleryServiceError('Une image et un texte alternatif sont requis.')
    await publishable(
      l,
      current.targets.map((x) => x.siteId),
    )
  }
  const state = transitionPublicContent(current, next, now)
  const updated = await updatePublicGalleryPublicationRow(id, l, current.status, expected, {
    status: state.status,
    publishedAt: state.publishedAt,
    publishedByMemberId: current.publishedByMemberId ?? m,
    updatedByMemberId: m,
    updatedAt: now,
  })
  if (!updated) concurrent()
  return {
    image: await getPublicGalleryImage(id, l),
    changed: true,
    previousStatus: current.status,
  }
}
export const publishPublicGalleryImage = (
  id: string,
  l: string,
  m: string,
  r: number,
  n = new Date(),
) => transition(id, l, 'published', m, r, n)
export const hidePublicGalleryImage = (
  id: string,
  l: string,
  m: string,
  r: number,
  n = new Date(),
) => transition(id, l, 'hidden', m, r, n)
export async function authorizePublicGalleryMediaScope(l: string, id: string, r: number) {
  rev(r)
  const current = await getPublicGalleryImage(id, l)
  if (current.revision !== r) concurrent()
  return createAuthorizedMediaScope({ ludoId: l, domain: 'gallery', entityId: id })
}
function scope(s: AuthorizedMediaScope, l: string, id: string, path?: string) {
  const a = l.toLowerCase(),
    b = id.toLowerCase(),
    p = path && parseManagedPublicSitePath(path)
  if (
    s.ludoId !== a ||
    s.domain !== 'gallery' ||
    s.entityId !== b ||
    (path && (!p || p.ludoId !== a || p.domain !== 'gallery' || p.entityId !== b))
  )
    throw new PublicGalleryServiceError("Le média n'appartient pas à cette image.")
}
export async function setPublicGalleryImageFile(
  l: string,
  id: string,
  m: string,
  r: number,
  s: AuthorizedMediaScope,
  blob: StoredBlob,
  alt: string,
  now = new Date(),
) {
  rev(r)
  scope(s, l, id, blob.pathname)
  if (!TYPES.includes(blob.contentType))
    throw new PublicGalleryServiceError('Format image non autorisé.')
  if (!Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > MAX)
    throw new PublicGalleryServiceError("L'image doit peser au maximum 8 MiB.")
  const current = await getPublicGalleryImage(id, l)
  if (current.revision !== r) concurrent()
  const updated = await updatePublicGalleryFileRow(id, l, r, {
    imageUrl: text(blob.url, "L'URL image", 2000),
    imageStorageKey: blob.pathname,
    alt: text(alt, 'Le texte alternatif', 300),
    updatedByMemberId: m,
    updatedAt: now,
  })
  if (!updated) concurrent()
  return { image: await getPublicGalleryImage(id, l), previousStorageKey: current.imageStorageKey }
}
export async function clearPublicGalleryImageFile(
  l: string,
  id: string,
  m: string,
  r: number,
  now = new Date(),
) {
  rev(r)
  const current = await getPublicGalleryImage(id, l)
  if (current.revision !== r) concurrent()
  if (current.status !== 'draft')
    throw new PublicGalleryServiceError('Une image publiée ne peut pas perdre son fichier.')
  const updated = await updatePublicGalleryFileRow(id, l, r, {
    imageUrl: null,
    imageStorageKey: null,
    alt: current.alt,
    updatedByMemberId: m,
    updatedAt: now,
  })
  if (!updated) concurrent()
  return { image: await getPublicGalleryImage(id, l), previousStorageKey: current.imageStorageKey }
}
export async function deleteDraftPublicGalleryImage(id: string, l: string, r: number) {
  rev(r)
  const current = await getPublicGalleryImage(id, l)
  if (current.status !== 'draft')
    throw new PublicGalleryServiceError('Seul un brouillon peut être supprimé.')
  if (current.revision !== r) concurrent()
  const deleted = await deleteDraftPublicGalleryRow(id, l, r)
  if (!deleted) concurrent()
  return { previousStorageKey: deleted.imageStorageKey }
}
export async function listVisiblePublicGallery(l: string, siteId?: string, limit = 50) {
  if (!(await isPublicSiteEnabled(l))) return []
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new PublicGalleryServiceError('Limite invalide.')
  if (siteId && !(await listActiveSiteRows(l)).some((x) => x.ludoId === l && x.id === siteId))
    return []
  return listVisiblePublicGalleryRows(l, siteId, Math.min(limit, 100))
}
