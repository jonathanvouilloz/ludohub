import { randomUUID } from 'node:crypto'
import {
  deleteDraftPublicDirectoryRow,
  getPublicDirectoryRowForLudo,
  insertPublicDirectoryRow,
  listPublicDirectoryRows,
  listPublishedPublicDirectoryRows,
  updatePublicDirectoryPublicationRow,
  updatePublicDirectoryRow,
} from '../db/public-directory.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import {
  PublicFaqServiceError,
  validatePublicEditorialMarkdown,
  validatePublicEditorialText,
  validatePublicSortOrder,
} from './public-faqs.js'
import { isPublicSiteEnabled } from './public-site.js'
export class PublicDirectoryServiceError extends Error {}
export type PublicDirectoryInput = {
  slug: string
  name: string
  descriptionMarkdown?: string | null
  address?: string | null
  postalCode?: string | null
  city: string
  phone?: string | null
  email?: string | null
  website?: string | null
  directionsUrl: string
  officialUrl: string
  sortOrder: number
}
export type PublicDirectoryUpdateInput = Partial<PublicDirectoryInput>
function tr(e: unknown): never {
  if (e instanceof PublicFaqServiceError) throw new PublicDirectoryServiceError(e.message)
  throw e
}
function text(v: string, l: string, m: number) {
  try {
    return validatePublicEditorialText(v, l, m)
  } catch (e) {
    tr(e)
  }
}
function webUrl(v: string, label: string) {
  const value = text(v, label, 2000)
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error()
    return parsed.toString()
  } catch {
    throw new PublicDirectoryServiceError(`${label} doit être une URL HTTP(S) valide.`)
  }
}
function optionalWebUrl(v: string | null | undefined, label: string) {
  if (v == null || v.trim() === '') return null
  return webUrl(v, label)
}
function optionalEmail(v: string | null | undefined) {
  const value = opt(v, "L'e-mail", 320)
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new PublicDirectoryServiceError("L'e-mail est invalide.")
  return value?.toLowerCase() ?? null
}
function opt(v: string | null | undefined, l: string, m: number) {
  return v == null ? null : text(v, l, m)
}
function md(v: string | null | undefined) {
  if (v == null) return null
  try {
    return validatePublicEditorialMarkdown(v, 'La description', 10000)
  } catch (e) {
    tr(e)
  }
}
function order(v: number) {
  try {
    return validatePublicSortOrder(v)
  } catch (e) {
    tr(e)
  }
}
export function normalizePublicDirectorySlug(v: string) {
  const s = v
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!s || s.length > 120) throw new PublicDirectoryServiceError('Slug invalide.')
  return s
}
function rev(v: number) {
  if (!Number.isSafeInteger(v) || v < 1) throw new PublicDirectoryServiceError('Révision invalide.')
}
function req<T>(v: T | undefined): T {
  if (!v) throw new PublicDirectoryServiceError('Entrée introuvable.')
  return v
}
function concurrent(): never {
  throw new PublicDirectoryServiceError("L'entrée a été modifiée simultanément. Rechargez-la.")
}
function write(e: unknown): never {
  if (typeof e === 'object' && e !== null && 'code' in e && e.code === '23505')
    throw new PublicDirectoryServiceError('Ce slug est déjà utilisé.')
  throw e
}
export const listPublicDirectoryForManagement = (l: string) => listPublicDirectoryRows(l)
export async function getPublicDirectoryEntry(id: string, l: string) {
  return req(await getPublicDirectoryRowForLudo(id, l))
}
export async function createPublicDirectoryEntry(
  l: string,
  m: string,
  i: PublicDirectoryInput,
  n = new Date(),
) {
  const state = createDraftPublicationState(n)
  try {
    return await insertPublicDirectoryRow({
      id: randomUUID(),
      ludoId: l,
      slug: normalizePublicDirectorySlug(i.slug),
      name: text(i.name, 'Le nom', 180),
      descriptionMarkdown: md(i.descriptionMarkdown),
      address: opt(i.address, "L'adresse", 500),
      postalCode: opt(i.postalCode, 'Le code postal', 20),
      city: text(i.city, 'La ville', 100),
      phone: opt(i.phone, 'Le téléphone', 50),
      email: optionalEmail(i.email),
      website: optionalWebUrl(i.website, 'Le site web'),
      directionsUrl: webUrl(i.directionsUrl, "Le lien d'itinéraire"),
      officialUrl: webUrl(i.officialUrl, 'La page officielle'),
      sortOrder: order(i.sortOrder),
      status: state.status,
      revision: 1,
      authorMemberId: m,
      updatedByMemberId: m,
      publishedByMemberId: null,
      publishedAt: null,
      createdAt: n,
      updatedAt: n,
    })
  } catch (e) {
    write(e)
  }
}
export async function updatePublicDirectoryEntry(
  id: string,
  l: string,
  i: PublicDirectoryUpdateInput,
  m: string,
  r: number,
  n = new Date(),
) {
  rev(r)
  const c = await getPublicDirectoryEntry(id, l)
  if (c.revision !== r) concurrent()
  const slug = i.slug === undefined ? c.slug : normalizePublicDirectorySlug(i.slug)
  if (c.publishedAt && slug !== c.slug)
    throw new PublicDirectoryServiceError('Le slug est figé après publication.')
  try {
    const u = await updatePublicDirectoryRow(id, l, r, {
      slug,
      name: i.name === undefined ? c.name : text(i.name, 'Le nom', 180),
      descriptionMarkdown:
        i.descriptionMarkdown === undefined ? c.descriptionMarkdown : md(i.descriptionMarkdown),
      address: i.address === undefined ? c.address : opt(i.address, "L'adresse", 500),
      postalCode:
        i.postalCode === undefined ? c.postalCode : opt(i.postalCode, 'Le code postal', 20),
      city: i.city === undefined ? c.city : text(i.city, 'La ville', 100),
      phone: i.phone === undefined ? c.phone : opt(i.phone, 'Le téléphone', 50),
      email: i.email === undefined ? c.email : optionalEmail(i.email),
      website: i.website === undefined ? c.website : optionalWebUrl(i.website, 'Le site web'),
      directionsUrl:
        i.directionsUrl === undefined
          ? c.directionsUrl
          : webUrl(i.directionsUrl, "Le lien d'itinéraire"),
      officialUrl:
        i.officialUrl === undefined ? c.officialUrl : webUrl(i.officialUrl, 'La page officielle'),
      sortOrder: i.sortOrder === undefined ? c.sortOrder : order(i.sortOrder),
      updatedByMemberId: m,
      updatedAt: n,
    })
    if (!u) concurrent()
    return u
  } catch (e) {
    write(e)
  }
}
async function transition(
  id: string,
  l: string,
  next: 'published' | 'hidden',
  m: string,
  r: number,
  n: Date,
) {
  rev(r)
  const c = await getPublicDirectoryEntry(id, l)
  if (c.revision !== r) concurrent()
  if (c.status === next) return { entry: c, changed: false, previousStatus: next }
  if (next === 'hidden' && c.status === 'draft')
    throw new PublicDirectoryServiceError('Un brouillon ne peut pas être masqué.')
  if (next === 'published' && !(await isPublicSiteEnabled(l)))
    throw new PublicDirectoryServiceError('Le module public doit être activé.')
  const s = transitionPublicContent(c, next, n),
    u = await updatePublicDirectoryPublicationRow(id, l, c.status, r, {
      status: s.status,
      publishedAt: s.publishedAt,
      publishedByMemberId: c.publishedByMemberId ?? m,
      updatedByMemberId: m,
      updatedAt: n,
    })
  if (!u) concurrent()
  return { entry: await getPublicDirectoryEntry(id, l), changed: true, previousStatus: c.status }
}
export const publishPublicDirectoryEntry = (
  id: string,
  l: string,
  m: string,
  r: number,
  n = new Date(),
) => transition(id, l, 'published', m, r, n)
export const hidePublicDirectoryEntry = (
  id: string,
  l: string,
  m: string,
  r: number,
  n = new Date(),
) => transition(id, l, 'hidden', m, r, n)
export async function deleteDraftPublicDirectoryEntry(id: string, l: string, r: number) {
  rev(r)
  const c = await getPublicDirectoryEntry(id, l)
  if (c.status !== 'draft')
    throw new PublicDirectoryServiceError('Seul un brouillon peut être supprimé.')
  if (c.revision !== r || !(await deleteDraftPublicDirectoryRow(id, l, r))) concurrent()
}
export async function listPublishedPublicDirectory(l: string, limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new PublicDirectoryServiceError('Limite invalide.')
  return listPublishedPublicDirectoryRows(l, Math.min(limit, 200))
}
