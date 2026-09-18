import { randomUUID } from 'node:crypto'
import {
  deleteDraftPublicTopThreeRow,
  deletePublicTopThreeRow,
  deselectPublicTopThreeHomepageRow,
  getPublishedPublicTopThreeRowBySlug,
  getPublicTopThreeRowForLudo,
  insertPublicTopThreeAtomic,
  listPublicTopThreeRows,
  listPublicTopThreeSlugRows,
  listVisiblePublicTopThreeSummaryRows,
  selectPublicTopThreeHomepageAtomic,
  updatePublicTopThreeAtomic,
  updatePublicTopThreeGamesMediaRow,
  updatePublicTopThreePublicationRow,
} from '../db/public-top-threes.js'
import { listActiveSiteRows } from '../db/sites.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import type { PublicTopThreeGame as PublicTopThreeGameShape } from '../schema.js'
import type { StoredBlob } from '../media/blob-storage.js'
import {
  createAuthorizedMediaScope,
  parseManagedPublicSitePath,
  type AuthorizedMediaScope,
} from '../media/paths.js'
import type { PublicAnnouncementTargeting } from './public-announcements.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'

export class PublicTopThreeServiceError extends Error {}

export type PublicTopThreeGame = PublicTopThreeGameShape
export type PublicTopThreeEditableGame = Pick<PublicTopThreeGameShape, 'name' | 'description'>
export type PublicTopThreeTargeting = PublicAnnouncementTargeting
export type PublicTopThreeInput = {
  /** Absent depuis le back-office : le slug se dérive alors du nom du Top 3. */
  slug?: string
  theme: string
  games: PublicTopThreeEditableGame[]
  /** Met le Top 3 en ligne dès l'insertion, sans passer par un brouillon. */
  publish?: boolean
} & PublicTopThreeTargeting
export type PublicTopThreeUpdateInput = Partial<
  Pick<PublicTopThreeInput, 'slug' | 'theme' | 'games'>
> &
  (PublicTopThreeTargeting | { targetMode?: undefined; siteIds?: undefined })

type TopThreeWithTargets = Awaited<ReturnType<typeof getPublicTopThreeRowForLudo>>

function text(value: string, label: string, max: number) {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized || normalized.length > max) {
    throw new PublicTopThreeServiceError(`${label} doit contenir entre 1 et ${max} caractères.`)
  }
  return normalized
}

const markdownEntity = /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/i
const markdownScheme = /^([a-z][a-z0-9+.-]*):/i
const allowedSchemes = new Set(['http', 'https', 'mailto'])

function markdown(value: string) {
  const normalized = text(value, 'La description', 2000)
  if (/[<>]/.test(normalized)) {
    throw new PublicTopThreeServiceError("Le HTML brut n'est pas autorisé dans les descriptions.")
  }
  const urls = [
    ...normalized.matchAll(/\]\(\s*([^\s)]+)/g),
    ...normalized.matchAll(/\]:\s*(?:<([^>\n]*)>|(\S+))/g),
  ].map((match) => match[1] ?? match[2])
  for (const raw of urls) {
    if (markdownEntity.test(raw)) {
      throw new PublicTopThreeServiceError('Une description contient un lien non autorisé.')
    }
    const url = raw.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1').trim()
    const scheme = markdownScheme.exec(url)?.[1]?.toLowerCase()
    if (scheme && !allowedSchemes.has(scheme)) {
      throw new PublicTopThreeServiceError('Une description contient un lien non autorisé.')
    }
  }
  return normalized
}

export function validatePublicTopThreeGames(
  games: PublicTopThreeEditableGame[],
  existing: PublicTopThreeGame[] = [],
) {
  if (!Array.isArray(games) || games.length !== 3) {
    throw new PublicTopThreeServiceError('Un Top 3 doit contenir exactement trois jeux.')
  }
  return games.map((game, index) => {
    if (!game || typeof game !== 'object' || Array.isArray(game)) {
      throw new PublicTopThreeServiceError(`Le jeu en position ${index + 1} est invalide.`)
    }
    const keys = Object.keys(game)
    if (keys.some((key) => key !== 'name' && key !== 'description')) {
      throw new PublicTopThreeServiceError(
        `Le jeu en position ${index + 1} contient un champ inconnu.`,
      )
    }
    if (
      typeof game.name !== 'string' ||
      (game.description !== undefined && typeof game.description !== 'string')
    ) {
      throw new PublicTopThreeServiceError(`Le jeu en position ${index + 1} est invalide.`)
    }
    const name = text(game.name, `Le nom du jeu en position ${index + 1}`, 160)
    const preserved = existing[index]
    const media =
      preserved?.imageUrl && preserved.imageStorageKey && preserved.imageAlt
        ? {
            imageUrl: preserved.imageUrl,
            imageStorageKey: preserved.imageStorageKey,
            imageAlt: preserved.imageAlt,
          }
        : {}
    if (game.description === undefined) return { name, ...media }
    return { name, description: markdown(game.description), ...media }
  })
}

export function normalizePublicTopThreeSlug(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug || slug.length > 120) {
    throw new PublicTopThreeServiceError('Le slug doit contenir entre 1 et 120 caractères.')
  }
  return slug
}

const SLUG_FALLBACK = 'top-3'

function slugCandidate(theme: string) {
  try {
    return normalizePublicTopThreeSlug(theme.slice(0, 100))
  } catch {
    return SLUG_FALLBACK
  }
}

/** Le slug n'est plus saisi côté back-office : il se dérive du nom, suffixé s'il est déjà pris. */
async function availableTopThreeSlug(ludoId: string, theme: string) {
  const base = slugCandidate(theme)
  const taken = new Set((await listPublicTopThreeSlugRows(ludoId)).map((row) => row.slug))
  if (!taken.has(base)) return base
  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!taken.has(candidate)) return candidate
  }
  return uniqueSlugFallback(base)
}

function uniqueSlugFallback(base: string) {
  return `${base.slice(0, 100)}-${Date.now().toString(36)}`
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

function revision(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new PublicTopThreeServiceError('La révision du Top 3 est invalide.')
  }
}

function concurrent(): never {
  throw new PublicTopThreeServiceError(
    'Le Top 3 a été modifié simultanément. Rechargez-le avant de réessayer.',
  )
}

function required<T>(row: T | undefined): T {
  if (!row) throw new PublicTopThreeServiceError('Top 3 introuvable.')
  return row
}

function writeError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new PublicTopThreeServiceError('Ce slug est déjà utilisé par un autre Top 3.')
  }
  throw error
}

async function targets(
  ludoId: string,
  mode: 'all' | 'explicit' | undefined,
  siteIds: string[] | undefined,
  preserved?: string[],
) {
  if (mode === undefined && siteIds === undefined && preserved) return preserved
  if (mode === undefined || siteIds === undefined) {
    throw new PublicTopThreeServiceError('Le mode de ciblage et ses lieux sont requis.')
  }
  const uniqueIds = [...new Set(siteIds)]
  if (uniqueIds.length !== siteIds.length) {
    throw new PublicTopThreeServiceError('Un lieu ne peut être ciblé plusieurs fois.')
  }
  if (mode === 'all') {
    if (siteIds.length) {
      throw new PublicTopThreeServiceError('Le ciblage de tous les lieux exige une liste vide.')
    }
    return []
  }
  if (!siteIds.length) {
    throw new PublicTopThreeServiceError('Le ciblage explicite exige au moins un lieu actif.')
  }
  await validatePublicSiteTargets(ludoId, siteIds)
  return siteIds
}

export const listPublicTopThreesForManagement = (ludoId: string) => listPublicTopThreeRows(ludoId)

export async function getPublicTopThree(topThreeId: string, ludoId: string) {
  return required(await getPublicTopThreeRowForLudo(topThreeId, ludoId))
}

export async function createPublicTopThree(
  ludoId: string,
  memberId: string,
  input: PublicTopThreeInput,
  now = new Date(),
) {
  const siteIds = await targets(ludoId, input.targetMode, input.siteIds)
  const theme = text(input.theme, 'Le thème', 160)
  const games = validatePublicTopThreeGames(input.games)
  if (input.publish) await ensureActiveSites(ludoId, siteIds)
  const publication = input.publish
    ? { status: 'published' as const, publishedAt: now, publishedByMemberId: memberId }
    : { ...createDraftPublicationState(now), publishedByMemberId: null }
  const chosenSlug = input.slug
  let slug =
    chosenSlug === undefined
      ? await availableTopThreeSlug(ludoId, theme)
      : normalizePublicTopThreeSlug(chosenSlug)

  for (let attempt = 0; ; attempt += 1) {
    try {
      return required(
        await insertPublicTopThreeAtomic(
          {
            id: randomUUID(),
            ludoId,
            slug,
            theme,
            games,
            isHomepage: false,
            status: publication.status,
            revision: 1,
            authorMemberId: memberId,
            updatedByMemberId: memberId,
            publishedByMemberId: publication.publishedByMemberId,
            publishedAt: publication.publishedAt,
            createdAt: now,
            updatedAt: now,
          },
          siteIds,
        ),
      )
    } catch (error) {
      // Slug dérivé et invisible côté staff : une collision concurrente se résout seule.
      if (chosenSlug === undefined && attempt === 0 && isUniqueViolation(error)) {
        slug = uniqueSlugFallback(slug)
        continue
      }
      writeError(error)
    }
  }
}

export async function updatePublicTopThree(
  topThreeId: string,
  ludoId: string,
  input: PublicTopThreeUpdateInput,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const current = await getPublicTopThree(topThreeId, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  const siteIds = await targets(
    ludoId,
    input.targetMode,
    input.siteIds,
    current.targets.map((target) => target.siteId),
  )
  const slug = input.slug === undefined ? current.slug : normalizePublicTopThreeSlug(input.slug)
  if (current.publishedAt && slug !== current.slug) {
    throw new PublicTopThreeServiceError('Le slug ne peut plus être modifié après publication.')
  }
  try {
    const updated = await updatePublicTopThreeAtomic(
      topThreeId,
      ludoId,
      expectedRevision,
      {
        slug,
        theme: input.theme === undefined ? current.theme : text(input.theme, 'Le thème', 160),
        games:
          input.games === undefined
            ? current.games
            : validatePublicTopThreeGames(input.games, current.games),
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

async function ensureActiveSites(ludoId: string, siteIds: string[]) {
  if (siteIds.length) {
    await validatePublicSiteTargets(ludoId, siteIds)
    return
  }
  const active = (await listActiveSiteRows(ludoId)).filter((site) => site.ludoId === ludoId)
  if (!active.length) {
    throw new PublicTopThreeServiceError('La publication exige au moins un lieu actif.')
  }
}

async function ensurePublishable(current: NonNullable<TopThreeWithTargets>, ludoId: string) {
  if (!(await isPublicSiteEnabled(ludoId))) {
    throw new PublicTopThreeServiceError('Le module public doit être activé avant publication.')
  }
  await ensureActiveSites(
    ludoId,
    current.targets.map((target) => target.siteId),
  )
}

async function transition(
  topThreeId: string,
  ludoId: string,
  next: 'published' | 'hidden',
  memberId: string,
  expectedRevision: number,
  now: Date,
) {
  revision(expectedRevision)
  const current = await getPublicTopThree(topThreeId, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  if (current.status === next) return { topThree: current, changed: false, previousStatus: next }
  if (next === 'hidden' && current.status === 'draft') {
    throw new PublicTopThreeServiceError('Un Top 3 en brouillon ne peut pas être masqué.')
  }
  if (next === 'published') await ensurePublishable(current, ludoId)
  const state = transitionPublicContent(current, next, now)
  const updated = await updatePublicTopThreePublicationRow(
    topThreeId,
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
    topThree: await getPublicTopThree(topThreeId, ludoId),
    changed: true,
    previousStatus: current.status,
  }
}

export const publishPublicTopThree = (
  id: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) => transition(id, ludoId, 'published', memberId, expectedRevision, now)

export const hidePublicTopThree = (
  id: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) => transition(id, ludoId, 'hidden', memberId, expectedRevision, now)

export async function selectPublicTopThreeForHomepage(
  id: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const current = await getPublicTopThree(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  if (current.status !== 'published') {
    throw new PublicTopThreeServiceError(
      "Seul un Top 3 publié peut être sélectionné pour l'accueil.",
    )
  }
  if (current.isHomepage) return { topThree: current, changed: false }
  try {
    const updated = await selectPublicTopThreeHomepageAtomic(
      id,
      ludoId,
      memberId,
      expectedRevision,
      now,
    )
    if (!updated) concurrent()
    return { topThree: updated, changed: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      concurrent()
    }
    throw error
  }
}

export async function deselectPublicTopThreeFromHomepage(
  id: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const current = await getPublicTopThree(id, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  if (!current.isHomepage) return { topThree: current, changed: false }
  const updated = await deselectPublicTopThreeHomepageRow(
    id,
    ludoId,
    memberId,
    expectedRevision,
    now,
  )
  if (!updated) concurrent()
  return { topThree: await getPublicTopThree(id, ludoId), changed: true }
}

export async function deleteDraftPublicTopThree(
  id: string,
  ludoId: string,
  expectedRevision: number,
) {
  revision(expectedRevision)
  const current = await getPublicTopThree(id, ludoId)
  if (current.status === 'published') {
    throw new PublicTopThreeServiceError('Masquez ce Top 3 avant de le supprimer.')
  }
  if (
    current.revision !== expectedRevision ||
    !(await deleteDraftPublicTopThreeRow(id, ludoId, expectedRevision))
  ) {
    concurrent()
  }
}

/** Suppression définitive demandée depuis le back-office, même si le Top 3 est publié. */
export async function permanentlyDeletePublicTopThree(
  id: string,
  ludoId: string,
  expectedRevision: number,
) {
  revision(expectedRevision)
  const current = await getPublicTopThree(id, ludoId)
  if (
    current.revision !== expectedRevision ||
    !(await deletePublicTopThreeRow(id, ludoId, expectedRevision))
  ) {
    concurrent()
  }
}

function gameIndex(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2) {
    throw new PublicTopThreeServiceError('La position du jeu est invalide.')
  }
  return value
}

function mediaScope(
  scope: AuthorizedMediaScope,
  ludoId: string,
  topThreeId: string,
  pathname?: string,
) {
  const parsed = pathname ? parseManagedPublicSitePath(pathname) : null
  if (
    scope.ludoId !== ludoId.toLowerCase() ||
    scope.domain !== 'top-games' ||
    scope.entityId !== topThreeId.toLowerCase() ||
    (pathname &&
      (!parsed ||
        parsed.ludoId !== ludoId.toLowerCase() ||
        parsed.domain !== 'top-games' ||
        parsed.entityId !== topThreeId.toLowerCase()))
  ) {
    throw new PublicTopThreeServiceError('L’image n’appartient pas à ce Top 3.')
  }
}

export async function authorizePublicTopThreeMediaScope(
  ludoId: string,
  topThreeId: string,
  expectedRevision: number,
) {
  revision(expectedRevision)
  const current = await getPublicTopThree(topThreeId, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  return createAuthorizedMediaScope({ ludoId, domain: 'top-games', entityId: topThreeId })
}

export async function setPublicTopThreeGameImage(
  ludoId: string,
  topThreeId: string,
  memberId: string,
  expectedRevision: number,
  index: number,
  scope: AuthorizedMediaScope,
  blob: StoredBlob,
  alt: string,
  now = new Date(),
) {
  revision(expectedRevision)
  const position = gameIndex(index)
  mediaScope(scope, ludoId, topThreeId, blob.pathname)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.contentType)) {
    throw new PublicTopThreeServiceError('Format image non autorisé.')
  }
  if (!Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > 5 * 1024 * 1024) {
    throw new PublicTopThreeServiceError('L’image doit peser au maximum 5 Mio.')
  }
  const current = await getPublicTopThree(topThreeId, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  const games = current.games.map((game, gamePosition) =>
    gamePosition === position
      ? {
          ...game,
          imageUrl: text(blob.url, 'L’URL de l’image', 2000),
          imageStorageKey: blob.pathname,
          imageAlt: text(alt, 'Le texte alternatif', 300),
        }
      : game,
  )
  const updated = await updatePublicTopThreeGamesMediaRow(
    topThreeId,
    ludoId,
    expectedRevision,
    games,
    memberId,
    now,
  )
  if (!updated) concurrent()
  return {
    topThree: await getPublicTopThree(topThreeId, ludoId),
    previousStorageKey: current.games[position]?.imageStorageKey ?? null,
  }
}

export async function clearPublicTopThreeGameImage(
  ludoId: string,
  topThreeId: string,
  memberId: string,
  expectedRevision: number,
  index: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const position = gameIndex(index)
  const current = await getPublicTopThree(topThreeId, ludoId)
  if (current.revision !== expectedRevision) concurrent()
  const previousStorageKey = current.games[position]?.imageStorageKey ?? null
  const games = current.games.map((game, gamePosition) => {
    if (gamePosition !== position) return game
    const withoutImage = { ...game }
    delete withoutImage.imageUrl
    delete withoutImage.imageStorageKey
    delete withoutImage.imageAlt
    return withoutImage
  })
  const updated = await updatePublicTopThreeGamesMediaRow(
    topThreeId,
    ludoId,
    expectedRevision,
    games,
    memberId,
    now,
  )
  if (!updated) concurrent()
  return { topThree: await getPublicTopThree(topThreeId, ludoId), previousStorageKey }
}

export async function listVisiblePublicTopThreeSummaries(
  ludoId: string,
  siteId?: string,
  limit = 20,
) {
  if (!(await isPublicSiteEnabled(ludoId))) return []
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new PublicTopThreeServiceError('La limite doit être un entier positif.')
  }
  if (siteId) {
    const active = (await listActiveSiteRows(ludoId)).filter((site) => site.ludoId === ludoId)
    if (!active.some((site) => site.id === siteId)) return []
  }
  return listVisiblePublicTopThreeSummaryRows(ludoId, siteId, Math.min(limit, 50))
}

function visibleAtSite(
  item: NonNullable<Awaited<ReturnType<typeof getPublishedPublicTopThreeRowBySlug>>>,
  activeIds: Set<string>,
  siteId?: string,
) {
  if (!item.targets.length) return siteId ? activeIds.has(siteId) : activeIds.size > 0
  return siteId
    ? item.targets.some((target) => target.siteId === siteId && activeIds.has(siteId))
    : item.targets.some((target) => activeIds.has(target.siteId))
}

export async function getVisiblePublicTopThreeBySlug(
  ludoId: string,
  slug: string,
  siteId?: string,
) {
  if (!(await isPublicSiteEnabled(ludoId))) return undefined
  const active = (await listActiveSiteRows(ludoId)).filter((site) => site.ludoId === ludoId)
  const activeIds = new Set(active.map((site) => site.id))
  if (siteId && !activeIds.has(siteId)) return undefined
  let normalized: string
  try {
    normalized = normalizePublicTopThreeSlug(slug)
  } catch {
    return undefined
  }
  const item = await getPublishedPublicTopThreeRowBySlug(ludoId, normalized)
  return item && visibleAtSite(item, activeIds, siteId) ? item : undefined
}
