import { randomUUID } from 'node:crypto'
import {
  deletePublicNewsRow,
  getPublicNewsRowForLudo,
  getPublishedPublicNewsRowBySlug,
  insertPublicNewsAtomic,
  listPublicNewsRows,
  listVisiblePublicNewsSummaryRows,
  updatePublicNewsAtomic,
  updatePublicNewsImageRow,
  updatePublicNewsPublicationRow,
} from '../db/public-news.js'
import { listActiveSiteRows } from '../db/sites.js'
import type { StoredBlob } from '../media/blob-storage.js'
import {
  createAuthorizedMediaScope,
  parseManagedPublicSitePath,
  type AuthorizedMediaScope,
} from '../media/paths.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import type { PublicAnnouncementTargeting } from './public-announcements.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'

export class PublicNewsServiceError extends Error {}

export type PublicNewsTargeting = PublicAnnouncementTargeting

type PublicNewsFields = {
  slug: string
  title: string
  summary: string
  body: string
}

export type PublicNewsInput = PublicNewsFields & PublicNewsTargeting

export type PublicNewsUpdateInput = Partial<PublicNewsFields> &
  (PublicNewsTargeting | { targetMode?: undefined; siteIds?: undefined })

type NewsWithTargets = Awaited<ReturnType<typeof getPublicNewsRowForLudo>>

function validateText(value: string, label: string, maxLength: number) {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized || normalized.length > maxLength) {
    throw new PublicNewsServiceError(`${label} doit contenir entre 1 et ${maxLength} caractères.`)
  }
  return normalized
}

const markdownUrlScheme = /^([a-z][a-z0-9+.-]*):/i
const allowedMarkdownUrlSchemes = new Set(['http', 'https', 'mailto'])
const markdownEntity = /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/i

function validateMarkdownUrl(rawUrl: string) {
  // CommonMark decodes character references and backslash escapes before emitting href.
  // Refuse encoded destinations instead of validating a different value than the renderer.
  if (markdownEntity.test(rawUrl)) {
    throw new PublicNewsServiceError('Le contenu Markdown contient un lien non autorisé.')
  }

  const normalizedUrl = rawUrl.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1').trim()
  const scheme = markdownUrlScheme.exec(normalizedUrl)?.[1]?.toLowerCase()
  if (scheme && !allowedMarkdownUrlSchemes.has(scheme)) {
    throw new PublicNewsServiceError('Le contenu Markdown contient un lien non autorisé.')
  }
}

function validateMarkdownUrls(markdown: string) {
  // Inline links/images. The URL is the first non-whitespace token; titles follow it.
  for (const match of markdown.matchAll(/\]\(\s*([^\s)]+)/g)) {
    validateMarkdownUrl(match[1])
  }

  // Reference definitions. Scan from the closing `]:` so escaped/nested label syntax
  // cannot hide the destination from this deliberately conservative validator.
  for (const match of markdown.matchAll(/\]:\s*(?:<([^>\n]*)>|(\S+))/g)) {
    validateMarkdownUrl(match[1] ?? match[2])
  }
}

export function validatePublicNewsMarkdown(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized || normalized.length > 50000) {
    throw new PublicNewsServiceError('Le contenu doit contenir entre 1 et 50000 caractères.')
  }
  // This contract deliberately disables raw HTML and CommonMark autolinks entirely.
  if (/[<>]/.test(normalized)) {
    throw new PublicNewsServiceError("Le HTML brut n'est pas autorisé dans le contenu Markdown.")
  }
  validateMarkdownUrls(normalized)
  return normalized
}

export function normalizePublicNewsSlug(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug || slug.length > 120) {
    throw new PublicNewsServiceError('Le slug doit contenir entre 1 et 120 caractères.')
  }
  return slug
}

function requireRevision(revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new PublicNewsServiceError('La révision de l’actualité est invalide.')
  }
}

function concurrentChange(): never {
  throw new PublicNewsServiceError(
    "L'actualité a été modifiée simultanément. Rechargez-la avant de réessayer.",
  )
}

function requireNews<T>(row: T | undefined): T {
  if (!row) throw new PublicNewsServiceError('Actualité introuvable.')
  return row
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

function throwNewsWriteError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new PublicNewsServiceError('Ce slug est déjà utilisé par une autre actualité.')
  }
  throw error
}

async function resolveTargeting(
  ludoId: string,
  targetMode: 'all' | 'explicit' | undefined,
  siteIds: string[] | undefined,
  preservedSiteIds?: string[],
) {
  if (targetMode === undefined && siteIds === undefined && preservedSiteIds) return preservedSiteIds
  if (targetMode === undefined || siteIds === undefined) {
    throw new PublicNewsServiceError('Le mode de ciblage et ses lieux sont requis.')
  }
  if (targetMode === 'all') {
    if (siteIds.length !== 0) {
      throw new PublicNewsServiceError(
        'Le ciblage de tous les lieux doit avoir une liste de lieux vide.',
      )
    }
    return []
  }
  if (siteIds.length === 0) {
    throw new PublicNewsServiceError('Le ciblage explicite exige au moins un lieu actif.')
  }
  await validatePublicSiteTargets(ludoId, siteIds)
  return siteIds
}

export async function listPublicNewsForManagement(ludoId: string) {
  return listPublicNewsRows(ludoId)
}

export async function getPublicNews(newsId: string, ludoId: string) {
  return requireNews(await getPublicNewsRowForLudo(newsId, ludoId))
}

export async function createPublicNews(
  ludoId: string,
  authorMemberId: string,
  input: PublicNewsInput,
  now = new Date(),
) {
  const siteIds = await resolveTargeting(ludoId, input.targetMode, input.siteIds)
  const publication = createDraftPublicationState(now)
  try {
    return requireNews(
      await insertPublicNewsAtomic(
        {
          id: randomUUID(),
          ludoId,
          slug: normalizePublicNewsSlug(input.slug),
          title: validateText(input.title, 'Le titre', 180),
          summary: validateText(input.summary, 'Le résumé', 500),
          body: validatePublicNewsMarkdown(input.body),
          imageUrl: null,
          imageStorageKey: null,
          imageAlt: null,
          status: publication.status,
          revision: 1,
          authorMemberId,
          updatedByMemberId: authorMemberId,
          publishedByMemberId: null,
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        siteIds,
      ),
    )
  } catch (error) {
    throwNewsWriteError(error)
  }
}

export async function updatePublicNews(
  newsId: string,
  ludoId: string,
  input: PublicNewsUpdateInput,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  requireRevision(expectedRevision)
  const current = await getPublicNews(newsId, ludoId)
  if (current.revision !== expectedRevision) concurrentChange()
  const siteIds = await resolveTargeting(
    ludoId,
    input.targetMode,
    input.siteIds,
    current.targets.map((target) => target.siteId),
  )
  const slug = input.slug === undefined ? current.slug : normalizePublicNewsSlug(input.slug)
  if (current.publishedAt && slug !== current.slug) {
    throw new PublicNewsServiceError('Le slug ne peut plus être modifié après publication.')
  }
  let updated
  try {
    updated = await updatePublicNewsAtomic(
      newsId,
      ludoId,
      expectedRevision,
      {
        slug,
        title:
          input.title === undefined ? current.title : validateText(input.title, 'Le titre', 180),
        summary:
          input.summary === undefined
            ? current.summary
            : validateText(input.summary, 'Le résumé', 500),
        body: input.body === undefined ? current.body : validatePublicNewsMarkdown(input.body),
        imageUrl: current.imageUrl,
        imageStorageKey: current.imageStorageKey,
        imageAlt: current.imageAlt,
        updatedByMemberId: memberId,
        updatedAt: now,
      },
      siteIds,
    )
  } catch (error) {
    throwNewsWriteError(error)
  }
  if (!updated) concurrentChange()
  return updated
}

async function ensurePublishableTargets(news: NonNullable<NewsWithTargets>, ludoId: string) {
  if (!(await isPublicSiteEnabled(ludoId))) {
    throw new PublicNewsServiceError('Le module public doit être activé avant publication.')
  }
  const siteIds = news.targets.map((target) => target.siteId)
  if (siteIds.length > 0) {
    await validatePublicSiteTargets(ludoId, siteIds)
  } else {
    const activeSites = (await listActiveSiteRows(ludoId)).filter((site) => site.ludoId === ludoId)
    if (activeSites.length === 0) {
      throw new PublicNewsServiceError('La publication exige au moins un lieu actif.')
    }
  }
}

async function transitionPublicNews(
  newsId: string,
  ludoId: string,
  nextStatus: 'published' | 'hidden',
  memberId: string,
  expectedRevision: number,
  now: Date,
) {
  requireRevision(expectedRevision)
  const current = await getPublicNews(newsId, ludoId)
  if (current.revision !== expectedRevision) concurrentChange()
  if (current.status === nextStatus) {
    return { news: current, changed: false, previousStatus: current.status }
  }
  if (nextStatus === 'hidden' && current.status === 'draft') {
    throw new PublicNewsServiceError('Une actualité en brouillon ne peut pas être masquée.')
  }
  if (nextStatus === 'published') await ensurePublishableTargets(current, ludoId)
  const publication = transitionPublicContent(current, nextStatus, now)
  const updated = await updatePublicNewsPublicationRow(
    newsId,
    ludoId,
    current.status,
    expectedRevision,
    {
      status: publication.status,
      publishedAt: publication.publishedAt,
      publishedByMemberId: current.publishedByMemberId ?? memberId,
      updatedByMemberId: memberId,
      updatedAt: now,
    },
  )
  if (!updated) concurrentChange()
  return {
    news: await getPublicNews(newsId, ludoId),
    changed: true,
    previousStatus: current.status,
  }
}

export function publishPublicNews(
  newsId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  return transitionPublicNews(newsId, ludoId, 'published', memberId, expectedRevision, now)
}

export function hidePublicNews(
  newsId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  return transitionPublicNews(newsId, ludoId, 'hidden', memberId, expectedRevision, now)
}

export async function deleteDraftPublicNews(newsId: string, ludoId: string) {
  const current = await getPublicNews(newsId, ludoId)
  if (current.status !== 'draft') {
    throw new PublicNewsServiceError('Seule une actualité jamais publiée peut être supprimée.')
  }
  if (!(await deletePublicNewsRow(newsId, ludoId))) {
    throw new PublicNewsServiceError('Actualité introuvable.')
  }
}

export async function authorizePublicNewsMediaScope(
  ludoId: string,
  newsId: string,
  expectedRevision: number,
): Promise<AuthorizedMediaScope> {
  requireRevision(expectedRevision)
  const current = await getPublicNews(newsId, ludoId)
  if (current.revision !== expectedRevision) concurrentChange()
  return createAuthorizedMediaScope({ ludoId, domain: 'news', entityId: newsId })
}

function requireNewsMediaScope(
  scope: AuthorizedMediaScope,
  ludoId: string,
  newsId: string,
  pathname?: string,
) {
  const normalizedLudoId = ludoId.toLowerCase()
  const normalizedNewsId = newsId.toLowerCase()
  if (
    scope.ludoId !== normalizedLudoId ||
    scope.domain !== 'news' ||
    scope.entityId !== normalizedNewsId
  ) {
    throw new PublicNewsServiceError("Le média n'appartient pas à cette actualité.")
  }
  if (pathname) {
    const parsed = parseManagedPublicSitePath(pathname)
    if (
      !parsed ||
      parsed.ludoId !== normalizedLudoId ||
      parsed.domain !== 'news' ||
      parsed.entityId !== normalizedNewsId
    ) {
      throw new PublicNewsServiceError("Le chemin du média n'appartient pas à cette actualité.")
    }
  }
}

export async function setPublicNewsImage(
  ludoId: string,
  newsId: string,
  memberId: string,
  expectedRevision: number,
  scope: AuthorizedMediaScope,
  blob: StoredBlob,
  alt: string,
  now = new Date(),
) {
  requireRevision(expectedRevision)
  requireNewsMediaScope(scope, ludoId, newsId, blob.pathname)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.contentType)) {
    throw new PublicNewsServiceError('Le média de couverture doit être une image.')
  }
  const current = await getPublicNews(newsId, ludoId)
  if (current.revision !== expectedRevision) concurrentChange()
  const updated = await updatePublicNewsImageRow(newsId, ludoId, expectedRevision, {
    imageUrl: validateText(blob.url, "L'URL de l'image", 2000),
    imageStorageKey: blob.pathname,
    imageAlt: validateText(alt, 'Le texte alternatif', 300),
    updatedByMemberId: memberId,
    updatedAt: now,
  })
  if (!updated) concurrentChange()
  return {
    news: await getPublicNews(newsId, ludoId),
    previousStorageKey: current.imageStorageKey,
  }
}

export async function clearPublicNewsImage(
  ludoId: string,
  newsId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  requireRevision(expectedRevision)
  const current = await getPublicNews(newsId, ludoId)
  if (current.revision !== expectedRevision) concurrentChange()
  const updated = await updatePublicNewsImageRow(newsId, ludoId, expectedRevision, {
    imageUrl: null,
    imageStorageKey: null,
    imageAlt: null,
    updatedByMemberId: memberId,
    updatedAt: now,
  })
  if (!updated) concurrentChange()
  return {
    news: await getPublicNews(newsId, ludoId),
    previousStorageKey: current.imageStorageKey,
  }
}

async function activeSiteIdsForPublicRead(ludoId: string, siteId?: string) {
  if (!(await isPublicSiteEnabled(ludoId))) return undefined
  const activeSites = (await listActiveSiteRows(ludoId)).filter((site) => site.ludoId === ludoId)
  const activeSiteIds = new Set(activeSites.map((site) => site.id))
  if (siteId && !activeSiteIds.has(siteId)) return undefined
  return activeSiteIds
}

function isVisibleAtSite(
  news: NonNullable<NewsWithTargets>,
  activeSiteIds: Set<string>,
  siteId?: string,
) {
  if (news.targets.length === 0) return siteId ? activeSiteIds.has(siteId) : activeSiteIds.size > 0
  return siteId
    ? news.targets.some((target) => target.siteId === siteId && activeSiteIds.has(siteId))
    : news.targets.some((target) => activeSiteIds.has(target.siteId))
}

export async function listVisiblePublicNewsSummaries(ludoId: string, siteId?: string, limit = 20) {
  if (!(await isPublicSiteEnabled(ludoId))) return []
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new PublicNewsServiceError('La limite doit être un entier positif.')
  }
  if (siteId) {
    const activeSites = (await listActiveSiteRows(ludoId)).filter((site) => site.ludoId === ludoId)
    if (!activeSites.some((site) => site.id === siteId)) return []
  }
  return listVisiblePublicNewsSummaryRows(ludoId, siteId, Math.min(limit, 50))
}

export function listVisiblePublicNews(ludoId: string, siteId?: string, limit = 20) {
  return listVisiblePublicNewsSummaries(ludoId, siteId, limit)
}

export async function listLatestVisiblePublicNews(ludoId: string, siteId?: string) {
  return listVisiblePublicNewsSummaries(ludoId, siteId, 3)
}

export async function getVisiblePublicNewsBySlug(ludoId: string, slug: string, siteId?: string) {
  const activeSiteIds = await activeSiteIdsForPublicRead(ludoId, siteId)
  if (!activeSiteIds) return undefined
  let normalizedSlug: string
  try {
    normalizedSlug = normalizePublicNewsSlug(slug)
  } catch {
    return undefined
  }
  const news = await getPublishedPublicNewsRowBySlug(ludoId, normalizedSlug)
  return news && isVisibleAtSite(news, activeSiteIds, siteId) ? news : undefined
}
