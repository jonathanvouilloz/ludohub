import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import {
  createPublicAnnouncement,
  listPublicAnnouncementsForManagement,
  PublicAnnouncementServiceError,
  setPublicAnnouncementActive,
  type PublicAnnouncementInput,
  type PublicAnnouncementTargeting,
  updatePublicAnnouncement,
} from '$lib/server/services/public-announcements.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import type { Actions, PageServerLoad } from './$types'

async function requireAnnouncementContext(event: RequestEvent) {
  const context = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(context.ludo.id))) {
    throw error(404, 'Module indisponible')
  }
  return context
}

function targetingInput(data: FormData): PublicAnnouncementTargeting {
  const targetMode = data.get('targetMode')
  const siteIds = data.getAll('siteIds').map(String)
  if (targetMode === 'all') {
    if (siteIds.length > 0) {
      throw new PublicAnnouncementServiceError(
        'Le ciblage de tous les lieux ne prend pas de lieu précis.',
      )
    }
    return { targetMode, siteIds: [] }
  }
  if (targetMode === 'explicit') {
    if (siteIds.length === 0) {
      throw new PublicAnnouncementServiceError('Sélectionnez au moins un lieu actif.')
    }
    return { targetMode, siteIds }
  }
  throw new PublicAnnouncementServiceError('Choisissez le mode de ciblage de l’annonce.')
}

function announcementInput(data: FormData): PublicAnnouncementInput {
  return {
    title: String(data.get('title') ?? ''),
    message: String(data.get('message') ?? ''),
    ...targetingInput(data),
  }
}

function parseRevision(data: FormData): number {
  const revision = Number(data.get('revision'))
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new PublicAnnouncementServiceError(
      'La version de l’annonce est invalide. Rechargez la page.',
    )
  }
  return revision
}

function targetMetadata(targeting: PublicAnnouncementTargeting) {
  return {
    targetMode: targeting.targetMode,
    targetSiteIds: targeting.siteIds,
  }
}

async function run(action: () => Promise<unknown>) {
  try {
    return await action()
  } catch (cause) {
    if (
      cause instanceof PublicAnnouncementServiceError ||
      cause instanceof PublicSiteServiceError
    ) {
      return fail(400, { error: cause.message })
    }
    throw cause
  }
}

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireAnnouncementContext(event)
  const [announcements, sites] = await Promise.all([
    listPublicAnnouncementsForManagement(ludo.id),
    listSiteRowsWithOpeningHours(ludo.id),
  ])
  return { announcements, sites }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo, member } = await requireAnnouncementContext(event)
    const data = await event.request.formData()
    return run(async () => {
      const input = announcementInput(data)
      const announcement = await createPublicAnnouncement(ludo.id, member.id, input)
      await emitAuditEvent({
        action: 'public_announcement.created',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_announcement',
        entityId: announcement.id,
        metadata: targetMetadata(input),
      })
      return { success: true }
    })
  },

  update: async (event) => {
    const { ludo, member } = await requireAnnouncementContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const input = announcementInput(data)
      const revision = parseRevision(data)
      const announcement = await updatePublicAnnouncement(id, ludo.id, input, member.id, revision)
      await emitAuditEvent({
        action: 'public_announcement.updated',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_announcement',
        entityId: announcement.id,
        metadata: targetMetadata(input),
      })
      return { success: true }
    })
  },

  toggle: async (event) => {
    const { ludo, member } = await requireAnnouncementContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    const active = data.get('active') === 'true'
    return run(async () => {
      const revision = parseRevision(data)
      const transition = await setPublicAnnouncementActive(id, ludo.id, active, member.id, revision)
      if (transition.changed) {
        await emitAuditEvent({
          action: active ? 'public_announcement.activated' : 'public_announcement.deactivated',
          actorLudoId: ludo.id,
          actorMemberId: member.id,
          entityType: 'public_announcement',
          entityId: transition.announcement.id,
          metadata: {
            fromStatus: transition.previousStatus,
            toStatus: transition.announcement.status,
          },
        })
      }
      return { success: true }
    })
  },
}
