import { randomUUID } from 'node:crypto'
import {
  deleteDraftPublicDocumentRow,
  getPublishedPublicDocumentBySlug,
  getPublicDocumentRowForLudo,
  insertPublicDocumentAtomic,
  listPublicDocumentRows,
  listVisiblePublicDocumentSummaryRows,
  updatePublicDocumentAtomic,
  updatePublicDocumentPdfRow,
  updatePublicDocumentPublicationRow,
} from '../db/public-documents.js'
import { listActiveSiteRows } from '../db/sites.js'
import type { StoredBlob } from '../media/blob-storage.js'
import {
  createAuthorizedMediaScope,
  parseManagedPublicSitePath,
  type AuthorizedMediaScope,
} from '../media/paths.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import type { PublicDocumentKind } from '../schema.js'
import {
  ensurePublicEditorialTargets,
  PublicFaqServiceError,
  type PublicFaqTargeting,
  resolvePublicEditorialTargets,
  validatePublicEditorialMarkdown,
  validatePublicEditorialText,
} from './public-faqs.js'
import { isPublicSiteEnabled } from './public-site.js'

export class PublicDocumentServiceError extends Error {}
export type PublicDocumentInput = {
  slug: string
  kind: PublicDocumentKind
  title: string
  summary?: string | null
  bodyMarkdown?: string | null
  year?: number | null
} & PublicFaqTargeting
export type PublicDocumentUpdateInput = Partial<
  Pick<PublicDocumentInput, 'slug' | 'kind' | 'title' | 'summary' | 'bodyMarkdown' | 'year'>
> &
  (PublicFaqTargeting | { targetMode?: undefined; siteIds?: undefined })
const kinds = new Set<PublicDocumentKind>(['mission', 'statutes', 'annual_report', 'other'])
const PDF_MAX_BYTES = 15 * 1024 * 1024

function translateFaqError(error: unknown): never {
  if (error instanceof PublicFaqServiceError) {
    throw new PublicDocumentServiceError(error.message)
  }
  throw error
}

function documentText(value: string, label: string, max: number) {
  try {
    return validatePublicEditorialText(value, label, max)
  } catch (error) {
    translateFaqError(error)
  }
}

function documentMarkdown(value: string, label: string, max: number) {
  try {
    return validatePublicEditorialMarkdown(value, label, max)
  } catch (error) {
    translateFaqError(error)
  }
}

async function documentTargets(
  ludoId: string,
  mode: 'all' | 'explicit' | undefined,
  siteIds: readonly string[] | undefined,
  preserved?: readonly string[],
) {
  try {
    return await resolvePublicEditorialTargets(ludoId, mode, siteIds, preserved)
  } catch (error) {
    translateFaqError(error)
  }
}

async function ensureDocumentTargets(ludoId: string, siteIds: string[]) {
  try {
    await ensurePublicEditorialTargets(ludoId, siteIds)
  } catch (error) {
    translateFaqError(error)
  }
}

export function normalizePublicDocumentSlug(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug || slug.length > 120) throw new PublicDocumentServiceError('Slug invalide.')
  return slug
}
function validateKindYear(kind: PublicDocumentKind, year: number | null | undefined) {
  if (!kinds.has(kind)) throw new PublicDocumentServiceError('Type de document invalide.')
  if (kind === 'annual_report') {
    if (!Number.isSafeInteger(year) || year! < 1000 || year! > 9999)
      throw new PublicDocumentServiceError("L'année est requise pour un rapport annuel.")
    return year as number
  }
  if (year !== null && year !== undefined)
    throw new PublicDocumentServiceError("L'année est réservée aux rapports annuels.")
  return null
}
function optionalText(value: string | null | undefined, label: string, max: number) {
  return value == null ? null : documentText(value, label, max)
}
function optionalMarkdown(value: string | null | undefined) {
  return value == null ? null : documentMarkdown(value, 'Le contenu', 50000)
}
function revision(value: number) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PublicDocumentServiceError('Révision invalide.')
}
function concurrent(): never {
  throw new PublicDocumentServiceError('Le document a été modifié simultanément. Rechargez-le.')
}
function required<T>(row: T | undefined): T {
  if (!row) throw new PublicDocumentServiceError('Document introuvable.')
  return row
}
function writeError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505')
    throw new PublicDocumentServiceError('Ce slug est déjà utilisé.')
  throw error
}

export const listPublicDocumentsForManagement = (ludoId: string) => listPublicDocumentRows(ludoId)
export async function getPublicDocument(id: string, ludoId: string) {
  return required(await getPublicDocumentRowForLudo(id, ludoId))
}
export async function createPublicDocument(
  ludoId: string,
  memberId: string,
  input: PublicDocumentInput,
  now = new Date(),
) {
  const siteIds = await documentTargets(ludoId, input.targetMode, input.siteIds)
  const state = createDraftPublicationState(now)
  try {
    return required(
      await insertPublicDocumentAtomic(
        {
          id: randomUUID(),
          ludoId,
          slug: normalizePublicDocumentSlug(input.slug),
          kind: input.kind,
          title: documentText(input.title, 'Le titre', 180),
          summary: optionalText(input.summary, 'Le résumé', 500),
          bodyMarkdown: optionalMarkdown(input.bodyMarkdown),
          year: validateKindYear(input.kind, input.year),
          pdfUrl: null,
          pdfStorageKey: null,
          pdfFileName: null,
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
  } catch (error) {
    writeError(error)
  }
}
export async function updatePublicDocument(
  id: string,
  ludoId: string,
  input: PublicDocumentUpdateInput,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const current = await getPublicDocument(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  const slug = input.slug === undefined ? current.slug : normalizePublicDocumentSlug(input.slug)
  if (current.publishedAt && slug !== current.slug)
    throw new PublicDocumentServiceError('Le slug ne peut plus être modifié après publication.')
  const kind = input.kind ?? current.kind
  const year = validateKindYear(kind, input.year === undefined ? current.year : input.year)
  const body =
    input.bodyMarkdown === undefined ? current.bodyMarkdown : optionalMarkdown(input.bodyMarkdown)
  if (current.status !== 'draft' && !body && !current.pdfStorageKey)
    throw new PublicDocumentServiceError('Le document doit conserver un contenu ou un PDF.')
  const siteIds = await documentTargets(
    ludoId,
    input.targetMode,
    input.siteIds,
    current.targets.map((x) => x.siteId),
  )
  try {
    const updated = await updatePublicDocumentAtomic(
      id,
      ludoId,
      expectedRevision,
      {
        slug,
        kind,
        title:
          input.title === undefined ? current.title : documentText(input.title, 'Le titre', 180),
        summary:
          input.summary === undefined
            ? current.summary
            : optionalText(input.summary, 'Le résumé', 500),
        bodyMarkdown: body,
        year,
        pdfUrl: current.pdfUrl,
        pdfStorageKey: current.pdfStorageKey,
        pdfFileName: current.pdfFileName,
        updatedByMemberId: memberId,
        updatedAt: now,
      },
      siteIds,
    )
    if (!updated) concurrent()
    return updated
  } catch (error) {
    writeError(error)
  }
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
  const current = await getPublicDocument(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  if (current.status === next) return { document: current, changed: false, previousStatus: next }
  if (next === 'hidden' && current.status === 'draft')
    throw new PublicDocumentServiceError('Un brouillon ne peut pas être masqué.')
  if (next === 'published') {
    if (!current.bodyMarkdown && !current.pdfStorageKey)
      throw new PublicDocumentServiceError('Un contenu Markdown ou un PDF est requis.')
    await ensureDocumentTargets(
      ludoId,
      current.targets.map((x) => x.siteId),
    )
  }
  const state = transitionPublicContent(current, next, now)
  const updated = await updatePublicDocumentPublicationRow(
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
  return {
    document: await getPublicDocument(id, ludoId),
    changed: true,
    previousStatus: current.status,
  }
}
export const publishPublicDocument = (
  id: string,
  ludoId: string,
  memberId: string,
  rev: number,
  now = new Date(),
) => transition(id, ludoId, 'published', memberId, rev, now)
export const hidePublicDocument = (
  id: string,
  ludoId: string,
  memberId: string,
  rev: number,
  now = new Date(),
) => transition(id, ludoId, 'hidden', memberId, rev, now)

export async function authorizePublicDocumentMediaScope(
  ludoId: string,
  id: string,
  expectedRevision: number,
) {
  revision(expectedRevision)
  const current = await getPublicDocument(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  return createAuthorizedMediaScope({ ludoId, domain: 'documents', entityId: id })
}
function requireScope(scope: AuthorizedMediaScope, ludoId: string, id: string, pathname?: string) {
  const lid = ludoId.toLowerCase(),
    eid = id.toLowerCase()
  if (scope.ludoId !== lid || scope.domain !== 'documents' || scope.entityId !== eid)
    throw new PublicDocumentServiceError("Le PDF n'appartient pas à ce document.")
  if (pathname) {
    const parsed = parseManagedPublicSitePath(pathname)
    if (
      !parsed ||
      parsed.ludoId !== lid ||
      parsed.domain !== 'documents' ||
      parsed.entityId !== eid
    )
      throw new PublicDocumentServiceError("Le chemin PDF n'appartient pas à ce document.")
  }
}
export async function setPublicDocumentPdf(
  ludoId: string,
  id: string,
  memberId: string,
  expectedRevision: number,
  scope: AuthorizedMediaScope,
  blob: StoredBlob,
  fileName: string,
  now = new Date(),
) {
  revision(expectedRevision)
  requireScope(scope, ludoId, id, blob.pathname)
  if (blob.contentType !== 'application/pdf')
    throw new PublicDocumentServiceError('Seuls les PDF sont autorisés.')
  if (!Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > PDF_MAX_BYTES)
    throw new PublicDocumentServiceError('Le PDF doit peser au maximum 15 MiB.')
  const current = await getPublicDocument(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  const updated = await updatePublicDocumentPdfRow(id, ludoId, expectedRevision, {
    pdfUrl: documentText(blob.url, "L'URL PDF", 2000),
    pdfStorageKey: blob.pathname,
    pdfFileName: documentText(fileName, 'Le nom du fichier', 300),
    updatedByMemberId: memberId,
    updatedAt: now,
  })
  if (!updated) concurrent()
  return {
    document: await getPublicDocument(id, ludoId),
    previousStorageKey: current.pdfStorageKey,
  }
}
export async function clearPublicDocumentPdf(
  ludoId: string,
  id: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const current = await getPublicDocument(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  if (current.status !== 'draft' && !current.bodyMarkdown)
    throw new PublicDocumentServiceError('Le document doit conserver un contenu Markdown.')
  const updated = await updatePublicDocumentPdfRow(id, ludoId, expectedRevision, {
    pdfUrl: null,
    pdfStorageKey: null,
    pdfFileName: null,
    updatedByMemberId: memberId,
    updatedAt: now,
  })
  if (!updated) concurrent()
  return {
    document: await getPublicDocument(id, ludoId),
    previousStorageKey: current.pdfStorageKey,
  }
}
export async function deleteDraftPublicDocument(
  id: string,
  ludoId: string,
  expectedRevision: number,
) {
  revision(expectedRevision)
  const current = await getPublicDocument(id, ludoId)
  if (current.status !== 'draft')
    throw new PublicDocumentServiceError('Seul un brouillon peut être supprimé.')
  if (current.revision !== expectedRevision) concurrent()
  const deleted = await deleteDraftPublicDocumentRow(id, ludoId, expectedRevision)
  if (!deleted) concurrent()
  return { previousStorageKey: deleted.pdfStorageKey }
}

export async function listVisiblePublicDocuments(ludoId: string, siteId?: string, limit = 20) {
  if (!(await isPublicSiteEnabled(ludoId))) return []
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new PublicDocumentServiceError('Limite invalide.')
  if (
    siteId &&
    !(await listActiveSiteRows(ludoId)).some((site) => site.ludoId === ludoId && site.id === siteId)
  )
    return []
  return listVisiblePublicDocumentSummaryRows(ludoId, siteId, Math.min(limit, 50))
}
function visible(
  item: NonNullable<Awaited<ReturnType<typeof getPublishedPublicDocumentBySlug>>>,
  active: Set<string>,
  siteId?: string,
) {
  if (!item.targets.length) return siteId ? active.has(siteId) : active.size > 0
  return siteId
    ? item.targets.some((x) => x.siteId === siteId && active.has(siteId))
    : item.targets.some((x) => active.has(x.siteId))
}
export async function getVisiblePublicDocumentBySlug(
  ludoId: string,
  slug: string,
  siteId?: string,
) {
  if (!(await isPublicSiteEnabled(ludoId))) return undefined
  const active = new Set(
    (await listActiveSiteRows(ludoId)).filter((x) => x.ludoId === ludoId).map((x) => x.id),
  )
  if (siteId && !active.has(siteId)) return undefined
  let normalized: string
  try {
    normalized = normalizePublicDocumentSlug(slug)
  } catch {
    return undefined
  }
  const item = await getPublishedPublicDocumentBySlug(ludoId, normalized)
  return item && visible(item, active, siteId) ? item : undefined
}
