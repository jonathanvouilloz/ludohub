import { randomUUID } from 'node:crypto'
import {
  getPublicActivityRowForLudo,
  getVisiblePublicActivityRowBySlug,
  insertPublicActivityAtomic,
  listPublicActivityRows,
  listVisiblePublicActivitySummaryRows,
  permanentlyDeletePublicActivityRow,
  updatePublicActivityAtomic,
  updatePublicActivityFeaturedRow,
  updatePublicActivityImageRow,
  updatePublicActivityLifecycleRow,
  updatePublicActivityPublicationRow,
  type ActivityDateInput,
  type ActivityExceptionInput,
} from '../db/public-activities.js'
import { listActiveSiteRows } from '../db/sites.js'
import type { StoredBlob } from '../media/blob-storage.js'
import {
  createAuthorizedMediaScope,
  parseManagedPublicSitePath,
  type AuthorizedMediaScope,
} from '../media/paths.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import type { PublicActivityType } from '../schema.js'
import type { PublicAnnouncementTargeting } from './public-announcements.js'
import { normalizePublicNewsSlug, validatePublicNewsMarkdown } from './public-news.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'

export class PublicActivityServiceError extends Error {}

export type PublicActivityTargeting = PublicAnnouncementTargeting
export type PublicActivityDateInput = { startsAt: Date; endsAt?: Date | null }
export type PublicActivityExceptionInput = { excludedAt: Date; reason?: string | null }

type PublicActivityFields = {
  slug: string
  title: string
  summary: string
  body: string
  location?: string | null
  type: PublicActivityType
  recurrenceRule?: string | null
  dates: PublicActivityDateInput[]
  exceptions: PublicActivityExceptionInput[]
}

export type PublicActivityInput = PublicActivityFields & PublicActivityTargeting
export type PublicActivityUpdateInput = Partial<PublicActivityFields> &
  (PublicActivityTargeting | { targetMode?: undefined; siteIds?: undefined })

type ActivityWithRelations = Awaited<ReturnType<typeof getPublicActivityRowForLudo>>

function text(value: string, label: string, max: number) {
  const normalized = value.trim()
  if (!normalized || normalized.length > max) {
    throw new PublicActivityServiceError(`${label} doit contenir entre 1 et ${max} caractères.`)
  }
  return normalized
}

function optionalText(value: string | null | undefined, label: string, max: number) {
  if (value == null || value.trim() === '') return null
  return text(value, label, max)
}

function revision(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new PublicActivityServiceError('La révision de l’activité est invalide.')
  }
}

function conflict(): never {
  throw new PublicActivityServiceError(
    "L'activité a été modifiée simultanément. Rechargez-la avant de réessayer.",
  )
}

function required<T>(value: T | undefined): T {
  if (!value) throw new PublicActivityServiceError('Activité introuvable.')
  return value
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

function writeError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new PublicActivityServiceError('Le slug ou le rang de mise en avant est déjà utilisé.')
  }
  throw error
}

function normalizeRule(value: string | null | undefined) {
  if (value == null) return null
  const normalized = value.trim().toUpperCase()
  if (!normalized || normalized.length > 1000 || /[\r\n]/.test(value)) {
    throw new PublicActivityServiceError('La règle de récurrence est invalide.')
  }
  const allowed = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL'])
  const values = new Map<string, string>()
  for (const segment of normalized.split(';')) {
    const [key, segmentValue, ...extra] = segment.split('=')
    if (!key || !segmentValue || extra.length || !allowed.has(key) || values.has(key)) {
      throw new PublicActivityServiceError(
        'La règle de récurrence contient une clé invalide ou dupliquée.',
      )
    }
    values.set(key, segmentValue)
  }
  const frequency = values.get('FREQ')
  if (!frequency || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency)) {
    throw new PublicActivityServiceError('La fréquence de récurrence est invalide.')
  }
  const interval = values.get('INTERVAL')
  if (interval && (!/^\d+$/.test(interval) || Number(interval) < 1 || Number(interval) > 365)) {
    throw new PublicActivityServiceError(
      "L'intervalle de récurrence doit être compris entre 1 et 365.",
    )
  }
  const byDay = values.get('BYDAY')
  if (byDay) {
    const days = byDay.split(',')
    if (
      frequency === 'DAILY' ||
      days.some((day) => !['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(day)) ||
      new Set(days).size !== days.length
    ) {
      throw new PublicActivityServiceError('Les jours de récurrence sont invalides.')
    }
  }
  const count = values.get('COUNT')
  if (count && (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 366)) {
    throw new PublicActivityServiceError(
      'Le nombre de récurrences doit être compris entre 1 et 366.',
    )
  }
  const until = values.get('UNTIL')
  if (until) {
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(until)
    if (!match)
      throw new PublicActivityServiceError('La date de fin RRULE doit être un instant UTC.')
    const [, year, month, day, hour, minute, second] = match.map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day ||
      parsed.getUTCHours() !== hour ||
      parsed.getUTCMinutes() !== minute ||
      parsed.getUTCSeconds() !== second
    ) {
      throw new PublicActivityServiceError("La date de fin RRULE n'existe pas.")
    }
  }
  if ((!count && !until) || (count && until)) {
    throw new PublicActivityServiceError('La récurrence exige exactement COUNT ou UNTIL.')
  }
  return ['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL']
    .filter((key) => values.has(key))
    .map((key) => `${key}=${values.get(key)}`)
    .join(';')
}

function validDate(value: Date, label: string) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new PublicActivityServiceError(`${label} est invalide.`)
  }
  return value
}

function normalizeSchedule(
  type: PublicActivityType,
  recurrenceRule: string | null | undefined,
  dates: PublicActivityDateInput[],
  exceptions: PublicActivityExceptionInput[],
) {
  if (dates.length > 366 || exceptions.length > 366) {
    throw new PublicActivityServiceError(
      'Une activité accepte au maximum 366 dates et 366 exceptions.',
    )
  }
  const normalizedDates: ActivityDateInput[] = dates.map((date) => {
    const startsAt = validDate(date.startsAt, 'La date de début')
    const endsAt = date.endsAt == null ? null : validDate(date.endsAt, 'La date de fin')
    if (endsAt && endsAt <= startsAt) {
      throw new PublicActivityServiceError('La date de fin doit suivre la date de début.')
    }
    return { startsAt, endsAt }
  })
  if (
    new Set(normalizedDates.map((date) => date.startsAt.getTime())).size !== normalizedDates.length
  ) {
    throw new PublicActivityServiceError('Les dates contiennent un doublon.')
  }
  const normalizedExceptions: ActivityExceptionInput[] = exceptions.map((exception) => ({
    excludedAt: validDate(exception.excludedAt, "La date d'exception"),
    reason: optionalText(exception.reason, "Le motif de l'exception", 500),
  }))
  if (
    new Set(normalizedExceptions.map((exception) => exception.excludedAt.getTime())).size !==
    normalizedExceptions.length
  ) {
    throw new PublicActivityServiceError('Les exceptions contiennent un doublon.')
  }

  if (type === 'permanent') {
    if (dates.length || exceptions.length || recurrenceRule != null) {
      throw new PublicActivityServiceError(
        'Une activité permanente ne porte ni dates, ni récurrence, ni exceptions.',
      )
    }
    return { recurrenceRule: null, dates: [], exceptions: [] }
  }
  if (normalizedDates.length === 0) {
    throw new PublicActivityServiceError('Cette activité exige au moins une date explicite.')
  }
  if (type === 'one_off') {
    if (recurrenceRule != null || exceptions.length) {
      throw new PublicActivityServiceError(
        'Une activité ponctuelle ne porte ni règle de récurrence, ni exception.',
      )
    }
    return { recurrenceRule: null, dates: normalizedDates, exceptions: [] }
  }
  const normalizedRule = normalizeRule(recurrenceRule)
  const untilValue = normalizedRule?.match(/(?:^|;)UNTIL=(\d{8}T\d{6}Z)(?:;|$)/)?.[1]
  if (untilValue) {
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(untilValue)!
    const [, year, month, day, hour, minute, second] = match.map(Number)
    const until = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    const firstOccurrence = new Date(
      Math.min(...normalizedDates.map((date) => date.startsAt.getTime())),
    )
    const fiveYearsAfterFirst = new Date(firstOccurrence)
    fiveYearsAfterFirst.setUTCFullYear(fiveYearsAfterFirst.getUTCFullYear() + 5)
    if (until < firstOccurrence || until > fiveYearsAfterFirst) {
      throw new PublicActivityServiceError(
        'UNTIL doit être compris entre la première occurrence et cinq années UTC après celle-ci.',
      )
    }
  }
  return {
    recurrenceRule: normalizedRule,
    dates: normalizedDates,
    exceptions: normalizedExceptions,
  }
}

async function targeting(
  ludoId: string,
  mode: 'all' | 'explicit' | undefined,
  siteIds: string[] | undefined,
  preserved?: string[],
) {
  if (mode === undefined && siteIds === undefined && preserved) return preserved
  if (mode === undefined || siteIds === undefined) {
    throw new PublicActivityServiceError('Le mode de ciblage et ses lieux sont requis.')
  }
  if (mode === 'all') {
    if (siteIds.length) {
      throw new PublicActivityServiceError('Le ciblage global exige une liste de lieux vide.')
    }
    return []
  }
  if (!siteIds.length) {
    throw new PublicActivityServiceError('Le ciblage explicite exige au moins un lieu actif.')
  }
  await validatePublicSiteTargets(ludoId, siteIds)
  return siteIds
}

export function listPublicActivitiesForManagement(ludoId: string) {
  return listPublicActivityRows(ludoId)
}

export async function getPublicActivity(activityId: string, ludoId: string) {
  return required(await getPublicActivityRowForLudo(activityId, ludoId))
}

export async function createPublicActivity(
  ludoId: string,
  memberId: string,
  input: PublicActivityInput,
  now = new Date(),
) {
  const siteIds = await targeting(ludoId, input.targetMode, input.siteIds)
  const schedule = normalizeSchedule(
    input.type,
    input.recurrenceRule,
    input.dates,
    input.exceptions,
  )
  const publication = createDraftPublicationState(now)
  try {
    return required(
      await insertPublicActivityAtomic(
        {
          id: randomUUID(),
          ludoId,
          slug: normalizePublicNewsSlug(input.slug),
          title: text(input.title, 'Le titre', 180),
          summary: text(input.summary, 'Le résumé', 500),
          body: validatePublicNewsMarkdown(input.body),
          location: optionalText(input.location, 'Le lieu', 500),
          type: input.type,
          recurrenceRule: schedule.recurrenceRule,
          imageUrl: null,
          imageStorageKey: null,
          imageAlt: null,
          status: publication.status,
          lifecycle: 'active',
          featuredRank: null,
          revision: 1,
          authorMemberId: memberId,
          updatedByMemberId: memberId,
          publishedByMemberId: null,
          publishedAt: null,
          archivedAt: null,
          trashedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        siteIds,
        schedule.dates,
        schedule.exceptions,
      ),
    )
  } catch (error) {
    writeError(error)
  }
}

export async function updatePublicActivity(
  activityId: string,
  ludoId: string,
  input: PublicActivityUpdateInput,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const current = await getPublicActivity(activityId, ludoId)
  if (current.revision !== expectedRevision) conflict()
  if (current.lifecycle !== 'active') {
    throw new PublicActivityServiceError(
      'Une activité archivée ou supprimée ne peut pas être modifiée.',
    )
  }
  const siteIds = await targeting(
    ludoId,
    input.targetMode,
    input.siteIds,
    current.targets.map((target) => target.siteId),
  )
  const type = input.type ?? current.type
  const schedule = normalizeSchedule(
    type,
    input.recurrenceRule === undefined ? current.recurrenceRule : input.recurrenceRule,
    input.dates ?? current.dates,
    input.exceptions ?? current.exceptions,
  )
  const slug = input.slug === undefined ? current.slug : normalizePublicNewsSlug(input.slug)
  if (current.publishedAt && slug !== current.slug) {
    throw new PublicActivityServiceError('Le slug ne peut plus être modifié après publication.')
  }
  try {
    const updated = await updatePublicActivityAtomic(
      activityId,
      ludoId,
      expectedRevision,
      {
        slug,
        title: input.title === undefined ? current.title : text(input.title, 'Le titre', 180),
        summary:
          input.summary === undefined ? current.summary : text(input.summary, 'Le résumé', 500),
        body: input.body === undefined ? current.body : validatePublicNewsMarkdown(input.body),
        location:
          input.location === undefined
            ? current.location
            : optionalText(input.location, 'Le lieu', 500),
        type,
        recurrenceRule: schedule.recurrenceRule,
        updatedByMemberId: memberId,
        updatedAt: now,
      },
      siteIds,
      schedule.dates,
      schedule.exceptions,
    )
    if (!updated) conflict()
    return updated
  } catch (error) {
    writeError(error)
  }
}

async function ensurePublishable(activity: NonNullable<ActivityWithRelations>, ludoId: string) {
  if (activity.lifecycle !== 'active') {
    throw new PublicActivityServiceError('Seule une activité active peut être publiée.')
  }
  if (!(await isPublicSiteEnabled(ludoId))) {
    throw new PublicActivityServiceError('Le module public doit être activé avant publication.')
  }
  const ids = activity.targets.map((target) => target.siteId)
  if (ids.length) await validatePublicSiteTargets(ludoId, ids)
  else if (!(await listActiveSiteRows(ludoId)).some((site) => site.ludoId === ludoId)) {
    throw new PublicActivityServiceError('La publication exige au moins un lieu actif.')
  }
}

async function publicationTransition(
  activityId: string,
  ludoId: string,
  nextStatus: 'published' | 'hidden',
  memberId: string,
  expectedRevision: number,
  now: Date,
) {
  revision(expectedRevision)
  const current = await getPublicActivity(activityId, ludoId)
  if (current.revision !== expectedRevision) conflict()
  if (current.status === nextStatus) {
    return { activity: current, changed: false, previousStatus: current.status }
  }
  if (nextStatus === 'hidden' && current.status === 'draft') {
    throw new PublicActivityServiceError('Un brouillon ne peut pas être masqué.')
  }
  if (nextStatus === 'published') await ensurePublishable(current, ludoId)
  const state = transitionPublicContent(current, nextStatus, now)
  const updated = await updatePublicActivityPublicationRow(
    activityId,
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
  if (!updated) conflict()
  return {
    activity: await getPublicActivity(activityId, ludoId),
    changed: true,
    previousStatus: current.status,
  }
}

export function publishPublicActivity(
  activityId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  return publicationTransition(activityId, ludoId, 'published', memberId, expectedRevision, now)
}

export function hidePublicActivity(
  activityId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  return publicationTransition(activityId, ludoId, 'hidden', memberId, expectedRevision, now)
}

async function lifecycleTransition(
  activityId: string,
  ludoId: string,
  next: 'active' | 'archived' | 'trashed',
  memberId: string,
  expectedRevision: number,
  now: Date,
) {
  revision(expectedRevision)
  const current = await getPublicActivity(activityId, ludoId)
  if (current.revision !== expectedRevision) conflict()
  if (current.lifecycle === next) {
    return { activity: current, changed: false, previousLifecycle: current.lifecycle }
  }
  const status = next === 'trashed' && current.status === 'published' ? 'hidden' : current.status
  const updated = await updatePublicActivityLifecycleRow(
    activityId,
    ludoId,
    current.lifecycle,
    expectedRevision,
    {
      lifecycle: next,
      status,
      featuredRank: next === 'active' ? current.featuredRank : null,
      archivedAt: next === 'archived' ? now : null,
      trashedAt: next === 'trashed' ? now : null,
      updatedByMemberId: memberId,
      updatedAt: now,
    },
  )
  if (!updated) conflict()
  return {
    activity: await getPublicActivity(activityId, ludoId),
    changed: true,
    previousLifecycle: current.lifecycle,
  }
}

export function archivePublicActivity(
  activityId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  return lifecycleTransition(activityId, ludoId, 'archived', memberId, expectedRevision, now)
}

export function trashPublicActivity(
  activityId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  return lifecycleTransition(activityId, ludoId, 'trashed', memberId, expectedRevision, now)
}

export function restorePublicActivity(
  activityId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  return lifecycleTransition(activityId, ludoId, 'active', memberId, expectedRevision, now)
}

export async function permanentlyDeletePublicActivity(
  activityId: string,
  ludoId: string,
  expectedRevision: number,
) {
  revision(expectedRevision)
  const current = await getPublicActivity(activityId, ludoId)
  if (current.revision !== expectedRevision) conflict()
  if (current.lifecycle !== 'trashed') {
    throw new PublicActivityServiceError(
      'Seule une activité dans la corbeille peut être supprimée.',
    )
  }
  if (!(await permanentlyDeletePublicActivityRow(activityId, ludoId, expectedRevision))) conflict()
}

export async function setPublicActivityFeaturedRank(
  activityId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  rank: number | null,
  now = new Date(),
) {
  revision(expectedRevision)
  if (rank !== null && (!Number.isSafeInteger(rank) || rank < 1 || rank > 3)) {
    throw new PublicActivityServiceError('Le rang de mise en avant doit être compris entre 1 et 3.')
  }
  const current = await getPublicActivity(activityId, ludoId)
  if (current.revision !== expectedRevision) conflict()
  if (rank !== null && (current.status !== 'published' || current.lifecycle !== 'active')) {
    throw new PublicActivityServiceError(
      'Seule une activité publiée et active peut être mise en avant.',
    )
  }
  if (rank !== null) await ensurePublishable(current, ludoId)
  try {
    const updated = await updatePublicActivityFeaturedRow(
      activityId,
      ludoId,
      expectedRevision,
      rank,
      memberId,
      now,
    )
    if (!updated) conflict()
    return getPublicActivity(activityId, ludoId)
  } catch (error) {
    writeError(error)
  }
}

export async function authorizePublicActivityMediaScope(
  ludoId: string,
  activityId: string,
  expectedRevision: number,
) {
  revision(expectedRevision)
  const current = await getPublicActivity(activityId, ludoId)
  if (current.revision !== expectedRevision) conflict()
  return createAuthorizedMediaScope({ ludoId, domain: 'activities', entityId: activityId })
}

function mediaScope(
  scope: AuthorizedMediaScope,
  ludoId: string,
  activityId: string,
  pathname: string,
) {
  const parsed = parseManagedPublicSitePath(pathname)
  if (
    scope.ludoId !== ludoId.toLowerCase() ||
    scope.domain !== 'activities' ||
    scope.entityId !== activityId.toLowerCase() ||
    !parsed ||
    parsed.ludoId !== ludoId.toLowerCase() ||
    parsed.domain !== 'activities' ||
    parsed.entityId !== activityId.toLowerCase()
  ) {
    throw new PublicActivityServiceError("Le média n'appartient pas à cette activité.")
  }
}

export async function setPublicActivityImage(
  ludoId: string,
  activityId: string,
  memberId: string,
  expectedRevision: number,
  scope: AuthorizedMediaScope,
  blob: StoredBlob,
  alt: string,
  now = new Date(),
) {
  revision(expectedRevision)
  mediaScope(scope, ludoId, activityId, blob.pathname)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.contentType)) {
    throw new PublicActivityServiceError('Le média de couverture doit être une image.')
  }
  const current = await getPublicActivity(activityId, ludoId)
  if (current.revision !== expectedRevision) conflict()
  const updated = await updatePublicActivityImageRow(activityId, ludoId, expectedRevision, {
    imageUrl: text(blob.url, "L'URL de l'image", 2000),
    imageStorageKey: blob.pathname,
    imageAlt: text(alt, 'Le texte alternatif', 300),
    updatedByMemberId: memberId,
    updatedAt: now,
  })
  if (!updated) conflict()
  return {
    activity: await getPublicActivity(activityId, ludoId),
    previousStorageKey: current.imageStorageKey,
  }
}

export async function clearPublicActivityImage(
  ludoId: string,
  activityId: string,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  revision(expectedRevision)
  const current = await getPublicActivity(activityId, ludoId)
  if (current.revision !== expectedRevision) conflict()
  const updated = await updatePublicActivityImageRow(activityId, ludoId, expectedRevision, {
    imageUrl: null,
    imageStorageKey: null,
    imageAlt: null,
    updatedByMemberId: memberId,
    updatedAt: now,
  })
  if (!updated) conflict()
  return {
    activity: await getPublicActivity(activityId, ludoId),
    previousStorageKey: current.imageStorageKey,
  }
}

async function publicAccess(ludoId: string, siteId?: string) {
  if (!(await isPublicSiteEnabled(ludoId))) return false
  if (!siteId) return true
  return (await listActiveSiteRows(ludoId)).some(
    (site) => site.ludoId === ludoId && site.id === siteId,
  )
}

function publicLimit(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new PublicActivityServiceError('La limite doit être un entier positif.')
  }
  return Math.min(value, 50)
}

export async function listVisiblePublicActivitySummaries(
  ludoId: string,
  siteId?: string,
  limit = 20,
) {
  if (!(await publicAccess(ludoId, siteId))) return []
  return listVisiblePublicActivitySummaryRows(ludoId, siteId, 'active', publicLimit(limit))
}

export async function listArchivedPublicActivitySummaries(
  ludoId: string,
  siteId?: string,
  limit = 20,
) {
  if (!(await publicAccess(ludoId, siteId))) return []
  return listVisiblePublicActivitySummaryRows(ludoId, siteId, 'archived', publicLimit(limit))
}

export async function getVisiblePublicActivityBySlug(
  ludoId: string,
  slug: string,
  siteId?: string,
) {
  if (!(await publicAccess(ludoId, siteId))) return undefined
  let normalized: string
  try {
    normalized = normalizePublicNewsSlug(slug)
  } catch {
    return undefined
  }
  const activity = await getVisiblePublicActivityRowBySlug(ludoId, normalized, siteId)
  if (!activity || activity.lifecycle === 'trashed') return undefined
  return {
    ...activity,
    targets: activity.targets.filter((target) => target.ludoId === ludoId && target.site?.isActive),
  }
}
