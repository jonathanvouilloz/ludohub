import { randomUUID } from 'node:crypto'
import {
  deleteDraftPublicProfileRow,
  deletePublicProfileRow,
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
  validatePublicEditorialText,
} from './public-faqs.js'
import { isPublicSiteEnabled } from './public-site.js'
export class PublicProfileServiceError extends Error {}
export type PublicProfileInput = {
  section: PublicProfileSection
  displayName: string
  roleTitle?: string | null
  bioText?: string | null
}
export type PublicProfileUpdateInput = Partial<
  Pick<PublicProfileInput, 'section' | 'displayName' | 'roleTitle' | 'bioText'>
>
const SECTIONS = new Set<PublicProfileSection>(['team', 'committee']),
  MAX = 5 * 1024 * 1024,
  TYPES = ['image/jpeg', 'image/png', 'image/webp']
function text(v: string, l: string, m: number) {
  try {
    return validatePublicEditorialText(v, l, m)
  } catch (error) {
    throw new PublicProfileServiceError(error instanceof Error ? error.message : 'Texte invalide.')
  }
}
function optional(v: string | null | undefined, l: string, m: number) {
  return v == null ? null : text(v, l, m)
}
function section(v: PublicProfileSection) {
  if (!SECTIONS.has(v)) throw new PublicProfileServiceError('Section invalide.')
  return v
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
  const state = createDraftPublicationState(now)
  return required(
    await insertPublicProfileAtomic(
      {
        id: randomUUID(),
        ludoId: l,
        section: section(input.section),
        displayName: text(input.displayName, 'Le nom affiché', 160),
        roleTitle: optional(input.roleTitle, 'Le rôle', 200),
        bioText: input.bioText == null ? null : text(input.bioText, 'La biographie', 255),
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
  const updated = await updatePublicProfileAtomic(
    id,
    l,
    r,
    {
      section: input.section === undefined ? current.section : section(input.section),
      displayName:
        input.displayName === undefined
          ? current.displayName
          : text(input.displayName, 'Le nom affiché', 160),
      roleTitle:
        input.roleTitle === undefined
          ? current.roleTitle
          : optional(input.roleTitle, 'Le rôle', 200),
      bioText:
        input.bioText === undefined
          ? current.bioText
          : input.bioText === null
            ? null
            : text(input.bioText, 'La biographie', 255),
      photoUrl: current.photoUrl,
      photoStorageKey: current.photoStorageKey,
      photoAlt: current.photoAlt,
      updatedByMemberId: m,
      updatedAt: now,
    },
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
    if (!(await isPublicSiteEnabled(l)) || !(await listActiveSiteRows(l)).length)
      throw new PublicProfileServiceError('La publication exige un site public actif avec un lieu actif.')
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
  if (current.status === 'published')
    throw new PublicProfileServiceError('Masquez ce profil avant de le supprimer.')
  if (current.revision !== r) concurrent()
  const deleted = await deleteDraftPublicProfileRow(id, l, r)
  if (!deleted) concurrent()
  return { previousStorageKey: deleted.photoStorageKey }
}

/** Suppression définitive demandée depuis le back-office, même si le profil est publié. */
export async function permanentlyDeletePublicProfile(id: string, l: string, r: number) {
  rev(r)
  const current = await getPublicProfile(id, l)
  if (current.revision !== r) concurrent()
  const deleted = await deletePublicProfileRow(id, l, r)
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
