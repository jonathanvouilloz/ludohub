import { randomUUID } from 'node:crypto'
import {
  deleteDraftPublicProfileRow,
  getPublicProfileRowForLudo,
  insertPublicProfileAtomic,
  listPublicProfileRows,
  listVisiblePublicProfileRows,
  updatePublicProfileAtomic,
  updatePublicProfilePhotoRow,
  updatePublicProfilePublicationRow,
} from '../db/public-profiles.js'
import { listActiveSiteRows } from '../db/sites.js'
import type { StoredBlob } from '../media/blob-storage.js'
import {
  createAuthorizedMediaScope,
  parseManagedPublicSitePath,
  type AuthorizedMediaScope,
} from '../media/paths.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import type { PublicProfileSection } from '../schema.js'
import {
  ensurePublicEditorialTargets,
  PublicFaqServiceError,
  type PublicFaqTargeting,
  resolvePublicEditorialTargets,
  validatePublicEditorialMarkdown,
  validatePublicEditorialText,
  validatePublicSortOrder,
} from './public-faqs.js'
import { isPublicSiteEnabled } from './public-site.js'
export class PublicProfileServiceError extends Error {}
export type PublicProfileInput = {
  memberId?: string | null
  section: PublicProfileSection
  displayName: string
  roleTitle?: string | null
  bioMarkdown?: string | null
  sortOrder: number
} & PublicFaqTargeting
export type PublicProfileUpdateInput = Partial<
  Pick<
    PublicProfileInput,
    'memberId' | 'section' | 'displayName' | 'roleTitle' | 'bioMarkdown' | 'sortOrder'
  >
> &
  (PublicFaqTargeting | { targetMode?: undefined; siteIds?: undefined })
const SECTIONS = new Set<PublicProfileSection>(['team', 'committee']),
  MAX = 5 * 1024 * 1024,
  TYPES = ['image/jpeg', 'image/png', 'image/webp']
function translate(e: unknown): never {
  if (e instanceof PublicFaqServiceError) throw new PublicProfileServiceError(e.message)
  throw e
}
function text(v: string, l: string, m: number) {
  try {
    return validatePublicEditorialText(v, l, m)
  } catch (e) {
    translate(e)
  }
}
function markdown(v: string) {
  try {
    return validatePublicEditorialMarkdown(v, 'La biographie', 10000)
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
function section(v: PublicProfileSection) {
  if (!SECTIONS.has(v)) throw new PublicProfileServiceError('Section invalide.')
  return v
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
  if (!Number.isSafeInteger(v) || v < 1) throw new PublicProfileServiceError('Révision invalide.')
}
function concurrent(): never {
  throw new PublicProfileServiceError('Le profil a été modifié simultanément. Rechargez-le.')
}
function required<T>(v: T | undefined): T {
  if (!v) throw new PublicProfileServiceError('Profil introuvable.')
  return v
}
export const listPublicProfilesForManagement = (l: string) => listPublicProfileRows(l)
export async function getPublicProfile(id: string, l: string) {
  return required(await getPublicProfileRowForLudo(id, l))
}
export async function createPublicProfile(
  l: string,
  m: string,
  input: PublicProfileInput,
  now = new Date(),
) {
  const siteIds = await targets(l, input.targetMode, input.siteIds),
    state = createDraftPublicationState(now)
  return required(
    await insertPublicProfileAtomic(
      {
        id: randomUUID(),
        ludoId: l,
        memberId: input.memberId ?? null,
        section: section(input.section),
        displayName: text(input.displayName, 'Le nom affiché', 160),
        roleTitle: optional(input.roleTitle, 'Le rôle', 200),
        bioMarkdown: input.bioMarkdown == null ? null : markdown(input.bioMarkdown),
        sortOrder: order(input.sortOrder),
        photoUrl: null,
        photoStorageKey: null,
        photoAlt: null,
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
export async function updatePublicProfile(
  id: string,
  l: string,
  input: PublicProfileUpdateInput,
  m: string,
  r: number,
  now = new Date(),
) {
  rev(r)
  const current = await getPublicProfile(id, l)
  if (current.revision !== r) concurrent()
  const siteIds = await targets(
    l,
    input.targetMode,
    input.siteIds,
    current.targets.map((x) => x.siteId),
  )
  const updated = await updatePublicProfileAtomic(
    id,
    l,
    r,
    {
      memberId: input.memberId === undefined ? current.memberId : input.memberId,
      section: input.section === undefined ? current.section : section(input.section),
      displayName:
        input.displayName === undefined
          ? current.displayName
          : text(input.displayName, 'Le nom affiché', 160),
      roleTitle:
        input.roleTitle === undefined
          ? current.roleTitle
          : optional(input.roleTitle, 'Le rôle', 200),
      bioMarkdown:
        input.bioMarkdown === undefined
          ? current.bioMarkdown
          : input.bioMarkdown === null
            ? null
            : markdown(input.bioMarkdown),
      sortOrder: input.sortOrder === undefined ? current.sortOrder : order(input.sortOrder),
      photoUrl: current.photoUrl,
      photoStorageKey: current.photoStorageKey,
      photoAlt: current.photoAlt,
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
  r: number,
  now: Date,
) {
  rev(r)
  const current = await getPublicProfile(id, l)
  if (current.revision !== r) concurrent()
  if (current.status === next) return { profile: current, changed: false, previousStatus: next }
  if (next === 'hidden' && current.status === 'draft')
    throw new PublicProfileServiceError('Un brouillon ne peut pas être masqué.')
  if (next === 'published') {
    if (!current.displayName.trim())
      throw new PublicProfileServiceError('Le nom affiché est requis.')
    await publishable(
      l,
      current.targets.map((x) => x.siteId),
    )
  }
  const state = transitionPublicContent(current, next, now)
  const updated = await updatePublicProfilePublicationRow(id, l, current.status, r, {
    status: state.status,
    publishedAt: state.publishedAt,
    publishedByMemberId: current.publishedByMemberId ?? m,
    updatedByMemberId: m,
    updatedAt: now,
  })
  if (!updated) concurrent()
  return { profile: await getPublicProfile(id, l), changed: true, previousStatus: current.status }
}
export const publishPublicProfile = (id: string, l: string, m: string, r: number, n = new Date()) =>
  transition(id, l, 'published', m, r, n)
export const hidePublicProfile = (id: string, l: string, m: string, r: number, n = new Date()) =>
  transition(id, l, 'hidden', m, r, n)
export async function authorizePublicProfileMediaScope(l: string, id: string, r: number) {
  rev(r)
  const current = await getPublicProfile(id, l)
  if (current.revision !== r) concurrent()
  return createAuthorizedMediaScope({ ludoId: l, domain: 'profiles', entityId: id })
}
function scope(s: AuthorizedMediaScope, l: string, id: string, path?: string) {
  const a = l.toLowerCase(),
    b = id.toLowerCase(),
    p = path && parseManagedPublicSitePath(path)
  if (
    s.ludoId !== a ||
    s.domain !== 'profiles' ||
    s.entityId !== b ||
    (path && (!p || p.ludoId !== a || p.domain !== 'profiles' || p.entityId !== b))
  )
    throw new PublicProfileServiceError("La photo n'appartient pas à ce profil.")
}
export async function setPublicProfilePhoto(
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
    throw new PublicProfileServiceError('Format image non autorisé.')
  if (!Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > MAX)
    throw new PublicProfileServiceError('La photo doit peser au maximum 5 MiB.')
  const current = await getPublicProfile(id, l)
  if (current.revision !== r) concurrent()
  const updated = await updatePublicProfilePhotoRow(id, l, r, {
    photoUrl: text(blob.url, "L'URL photo", 2000),
    photoStorageKey: blob.pathname,
    photoAlt: text(alt, 'Le texte alternatif', 300),
    updatedByMemberId: m,
    updatedAt: now,
  })
  if (!updated) concurrent()
  return { profile: await getPublicProfile(id, l), previousStorageKey: current.photoStorageKey }
}
export async function clearPublicProfilePhoto(
  l: string,
  id: string,
  m: string,
  r: number,
  now = new Date(),
) {
  rev(r)
  const current = await getPublicProfile(id, l)
  if (current.revision !== r) concurrent()
  const updated = await updatePublicProfilePhotoRow(id, l, r, {
    photoUrl: null,
    photoStorageKey: null,
    photoAlt: null,
    updatedByMemberId: m,
    updatedAt: now,
  })
  if (!updated) concurrent()
  return { profile: await getPublicProfile(id, l), previousStorageKey: current.photoStorageKey }
}
export async function deleteDraftPublicProfile(id: string, l: string, r: number) {
  rev(r)
  const current = await getPublicProfile(id, l)
  if (current.status !== 'draft')
    throw new PublicProfileServiceError('Seul un brouillon peut être supprimé.')
  if (current.revision !== r) concurrent()
  const deleted = await deleteDraftPublicProfileRow(id, l, r)
  if (!deleted) concurrent()
  return { previousStorageKey: deleted.photoStorageKey }
}
export async function listVisiblePublicProfiles(
  l: string,
  sectionFilter?: PublicProfileSection,
  siteId?: string,
  limit = 100,
) {
  if (sectionFilter !== undefined) section(sectionFilter)
  if (!(await isPublicSiteEnabled(l))) return []
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new PublicProfileServiceError('Limite invalide.')
  if (siteId && !(await listActiveSiteRows(l)).some((x) => x.ludoId === l && x.id === siteId))
    return []
  return listVisiblePublicProfileRows(l, sectionFilter, siteId, Math.min(limit, 200))
}
