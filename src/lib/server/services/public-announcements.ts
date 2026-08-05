import { randomUUID } from 'node:crypto'
import {
  deletePublicAnnouncementRow,
  getPublicAnnouncementRowForLudo,
  insertPublicAnnouncementAtomic,
  listPublicAnnouncementRows,
  listPublishedPublicAnnouncementRows,
  updatePublicAnnouncementAtomic,
  updatePublicAnnouncementPublicationRow,
} from '../db/public-announcements.js'
import { listActiveSiteRows } from '../db/sites.js'
import { createDraftPublicationState, transitionPublicContent } from '../public-content.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'

export class PublicAnnouncementServiceError extends Error {}

type PublicAnnouncementFields = {
  title: string
  message: string
}

export type PublicAnnouncementTargeting =
  | { targetMode: 'all'; siteIds: [] }
  | { targetMode: 'explicit'; siteIds: string[] }

export type PublicAnnouncementInput = PublicAnnouncementFields & PublicAnnouncementTargeting

export type PublicAnnouncementUpdateInput = Partial<PublicAnnouncementFields> &
  (PublicAnnouncementTargeting | { targetMode?: undefined; siteIds?: undefined })

export function sortPublicAnnouncements<T extends { id: string; createdAt: Date }>(
  announcements: T[],
): T[] {
  return [...announcements].sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id),
  )
}

function validateText(value: string, label: string, maxLength: number) {
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    throw new PublicAnnouncementServiceError(
      `${label} doit contenir entre 1 et ${maxLength} caractères.`,
    )
  }
  return normalized
}

function requireAnnouncement<T>(row: T | undefined): T {
  if (!row) throw new PublicAnnouncementServiceError('Annonce introuvable.')
  return row
}

function concurrentChange(): never {
  throw new PublicAnnouncementServiceError(
    "L'annonce a été modifiée simultanément. Rechargez-la avant de réessayer.",
  )
}

function requireRevision(revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new PublicAnnouncementServiceError('La révision de l’annonce est invalide.')
  }
}

async function resolveTargeting(
  ludoId: string,
  targetMode: 'all' | 'explicit' | undefined,
  siteIds: string[] | undefined,
  preservedSiteIds?: string[],
) {
  if (targetMode === undefined && siteIds === undefined && preservedSiteIds) {
    return preservedSiteIds
  }
  if (targetMode === undefined || siteIds === undefined) {
    throw new PublicAnnouncementServiceError('Le mode de ciblage et ses lieux sont requis.')
  }
  if (targetMode === 'all') {
    if (siteIds.length !== 0) {
      throw new PublicAnnouncementServiceError(
        'Le ciblage de tous les lieux doit avoir une liste de lieux vide.',
      )
    }
    return []
  }
  if (siteIds.length === 0) {
    throw new PublicAnnouncementServiceError('Le ciblage explicite exige au moins un lieu actif.')
  }
  await validatePublicSiteTargets(ludoId, siteIds)
  return siteIds
}

export async function listPublicAnnouncementsForManagement(ludoId: string) {
  return sortPublicAnnouncements(await listPublicAnnouncementRows(ludoId))
}

export async function getPublicAnnouncement(announcementId: string, ludoId: string) {
  return requireAnnouncement(await getPublicAnnouncementRowForLudo(announcementId, ludoId))
}

export async function createPublicAnnouncement(
  ludoId: string,
  authorMemberId: string,
  input: PublicAnnouncementInput,
  now = new Date(),
) {
  const siteIds = await resolveTargeting(ludoId, input.targetMode, input.siteIds)
  const publication = createDraftPublicationState(now)
  return requireAnnouncement(
    await insertPublicAnnouncementAtomic(
      {
        id: randomUUID(),
        ludoId,
        title: validateText(input.title, 'Le titre', 160),
        message: validateText(input.message, 'Le message', 2000),
        authorMemberId,
        updatedByMemberId: authorMemberId,
        publishedByMemberId: null,
        status: publication.status,
        publishedAt: publication.publishedAt,
        createdAt: now,
        updatedAt: publication.updatedAt,
      },
      siteIds,
    ),
  )
}

export async function updatePublicAnnouncement(
  announcementId: string,
  ludoId: string,
  input: PublicAnnouncementUpdateInput,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  requireRevision(expectedRevision)
  const current = await getPublicAnnouncement(announcementId, ludoId)
  if (current.revision !== expectedRevision) concurrentChange()
  const siteIds = await resolveTargeting(
    ludoId,
    input.targetMode,
    input.siteIds,
    current.targets.map((target) => target.siteId),
  )
  const updated = await updatePublicAnnouncementAtomic(
    announcementId,
    ludoId,
    expectedRevision,
    {
      title: input.title === undefined ? current.title : validateText(input.title, 'Le titre', 160),
      message:
        input.message === undefined
          ? current.message
          : validateText(input.message, 'Le message', 2000),
      updatedByMemberId: memberId,
      updatedAt: now,
    },
    siteIds,
  )
  if (!updated) concurrentChange()
  return updated
}

/** Active (= published) ou désactive (= hidden) une annonce, sans planification. */
export async function setPublicAnnouncementActive(
  announcementId: string,
  ludoId: string,
  active: boolean,
  memberId: string,
  expectedRevision: number,
  now = new Date(),
) {
  requireRevision(expectedRevision)
  const current = await getPublicAnnouncement(announcementId, ludoId)
  if (current.revision !== expectedRevision) concurrentChange()
  const nextStatus = active ? 'published' : current.status === 'draft' ? 'draft' : 'hidden'
  if (current.status === nextStatus) {
    return { announcement: current, changed: false, previousStatus: current.status }
  }

  if (active) {
    const siteIds = current.targets.map((target) => target.siteId)
    if (siteIds.length > 0) {
      await validatePublicSiteTargets(ludoId, siteIds)
    } else {
      const activeSites = (await listActiveSiteRows(ludoId)).filter(
        (site) => site.ludoId === ludoId,
      )
      if (activeSites.length === 0) {
        throw new PublicAnnouncementServiceError(
          'Une annonce visant tous les lieux exige au moins un lieu actif.',
        )
      }
    }
  }

  const publication = transitionPublicContent(current, nextStatus, now)
  const updated = await updatePublicAnnouncementPublicationRow(
    announcementId,
    ludoId,
    current.status,
    expectedRevision,
    {
      status: publication.status,
      publishedAt: publication.publishedAt,
      publishedByMemberId: current.publishedByMemberId ?? memberId,
      updatedByMemberId: memberId,
      updatedAt: publication.updatedAt,
    },
  )
  if (!updated) {
    concurrentChange()
  }
  return {
    announcement: await getPublicAnnouncement(announcementId, ludoId),
    changed: true,
    previousStatus: current.status,
  }
}

export async function deletePublicAnnouncement(announcementId: string, ludoId: string) {
  if (!(await deletePublicAnnouncementRow(announcementId, ludoId))) {
    throw new PublicAnnouncementServiceError('Annonce introuvable.')
  }
}

/**
 * Lecture publique tenant-scoped. Les lieux désactivés sont filtrés à la lecture,
 * y compris s'ils ont été désactivés après la publication.
 */
export async function listVisiblePublicAnnouncements(ludoId: string, siteId?: string) {
  if (!(await isPublicSiteEnabled(ludoId))) return []

  const activeSites = (await listActiveSiteRows(ludoId)).filter((site) => site.ludoId === ludoId)
  const activeSiteIds = new Set(activeSites.map((site) => site.id))
  if (siteId) {
    try {
      await validatePublicSiteTargets(ludoId, [siteId])
    } catch {
      return []
    }
  }

  const announcements = await listPublishedPublicAnnouncementRows(ludoId)
  return sortPublicAnnouncements(
    announcements.filter((announcement) => {
      if (announcement.targets.length === 0) {
        return siteId ? activeSiteIds.has(siteId) : activeSiteIds.size > 0
      }
      return siteId
        ? announcement.targets.some(
            (target) => target.siteId === siteId && activeSiteIds.has(siteId),
          )
        : announcement.targets.some((target) => activeSiteIds.has(target.siteId))
    }),
  )
}
