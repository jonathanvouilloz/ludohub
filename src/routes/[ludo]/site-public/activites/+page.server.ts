import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { parseZurichDateTimeLocal, ZurichDateTimeError } from '$lib/server/zurich-datetime.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import {
  deletePublicSiteMedia,
  MediaStorageError,
  uploadPublicSiteMedia,
} from '$lib/server/media/blob-storage.js'
import { MediaCompensationError, uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import type { AuthorizedMediaScope } from '$lib/server/media/paths.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import {
  archivePublicActivity,
  authorizePublicActivityMediaScope,
  clearPublicActivityImage,
  createPublicActivity,
  getPublicActivity,
  hidePublicActivity,
  listPublicActivitiesForManagement,
  permanentlyDeletePublicActivity,
  publishPublicActivity,
  PublicActivityServiceError,
  type PublicActivityDateInput,
  type PublicActivityExceptionInput,
  type PublicActivityInput,
  type PublicActivityTargeting,
  type PublicActivityUpdateInput,
  restorePublicActivity,
  setPublicActivityFeaturedRank,
  setPublicActivityImage,
  trashPublicActivity,
  updatePublicActivity,
} from '$lib/server/services/public-activities.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import type { Actions, PageServerLoad } from './$types'

async function requireActivityContext(event: RequestEvent) {
  const context = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(context.ludo.id))) throw error(404, 'Module indisponible')
  return context
}

function targetingInput(data: FormData): PublicActivityTargeting {
  const targetMode = data.get('targetMode')
  const siteIds = data.getAll('siteIds').map(String)
  if (targetMode === 'all') {
    if (siteIds.length)
      throw new PublicActivityServiceError('Le ciblage global ne prend pas de lieu précis.')
    return { targetMode, siteIds: [] }
  }
  if (targetMode === 'explicit') {
    if (!siteIds.length)
      throw new PublicActivityServiceError('Sélectionnez au moins un lieu actif.')
    return { targetMode, siteIds }
  }
  throw new PublicActivityServiceError('Choisissez le mode de ciblage de l’activité.')
}

function parseJsonArray(data: FormData, name: string) {
  try {
    const value = JSON.parse(String(data.get(name) ?? '[]'))
    if (!Array.isArray(value)) throw new Error()
    return value as unknown[]
  } catch {
    throw new PublicActivityServiceError('Le calendrier de l’activité est invalide.')
  }
}

function parseDate(value: unknown, label: string) {
  if (typeof value !== 'string' || !value)
    throw new PublicActivityServiceError(`${label} est invalide.`)
  try {
    return parseZurichDateTimeLocal(value)
  } catch (cause) {
    if (cause instanceof ZurichDateTimeError) {
      throw new PublicActivityServiceError(`${label} est invalide. ${cause.message}`)
    }
    throw cause
  }
}

function scheduleInput(data: FormData): {
  dates: PublicActivityDateInput[]
  exceptions: PublicActivityExceptionInput[]
} {
  const dates = parseJsonArray(data, 'dates').map((entry) => {
    if (!entry || typeof entry !== 'object')
      throw new PublicActivityServiceError('Une date est invalide.')
    const item = entry as Record<string, unknown>
    return {
      startsAt: parseDate(item.startsAt, 'La date de début'),
      endsAt: item.endsAt ? parseDate(item.endsAt, 'La date de fin') : null,
    }
  })
  const exceptions = parseJsonArray(data, 'exceptions').map((entry) => {
    if (!entry || typeof entry !== 'object')
      throw new PublicActivityServiceError('Une exception est invalide.')
    const item = entry as Record<string, unknown>
    return {
      excludedAt: parseDate(item.excludedAt, 'La date d’exception'),
      reason: typeof item.reason === 'string' && item.reason.trim() ? item.reason : null,
    }
  })
  return { dates, exceptions }
}

function activityType(data: FormData): PublicActivityInput['type'] {
  const type = data.get('type')
  if (type !== 'one_off' && type !== 'recurring' && type !== 'permanent') {
    throw new PublicActivityServiceError('Le type d’activité est invalide.')
  }
  return type
}

function createInput(data: FormData): PublicActivityInput {
  const type = activityType(data)
  return {
    slug: String(data.get('slug') ?? ''),
    title: String(data.get('title') ?? ''),
    summary: String(data.get('summary') ?? ''),
    body: String(data.get('body') ?? ''),
    location: String(data.get('location') ?? ''),
    type,
    recurrenceRule: type === 'recurring' ? String(data.get('recurrenceRule') ?? '') : null,
    ...scheduleInput(data),
    ...targetingInput(data),
  }
}

function updateInput(data: FormData): PublicActivityUpdateInput {
  return {
    ...createInput(data),
    ...(data.has('slug') ? { slug: String(data.get('slug') ?? '') } : { slug: undefined }),
  }
}

function parseRevision(data: FormData) {
  const revision = Number(data.get('revision'))
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new PublicActivityServiceError(
      'La version de l’activité est invalide. Rechargez la page.',
    )
  }
  return revision
}

function targetMetadata(targeting: PublicActivityTargeting) {
  return { targetMode: targeting.targetMode, targetSiteIds: targeting.siteIds }
}

async function run(action: () => Promise<unknown>) {
  try {
    return await action()
  } catch (cause) {
    if (
      cause instanceof PublicActivityServiceError ||
      cause instanceof PublicSiteServiceError ||
      cause instanceof MediaStorageError
    ) {
      return fail(400, { error: cause.message })
    }
    if (cause instanceof MediaCompensationError) return fail(500, { error: cause.message })
    throw cause
  }
}

async function audit(input: {
  action: string
  ludoId: string
  memberId: string
  activityId: string
  metadata?: Record<string, unknown>
}) {
  await emitAuditEvent({
    action: input.action,
    actorLudoId: input.ludoId,
    actorMemberId: input.memberId,
    entityType: 'public_activity',
    entityId: input.activityId,
    metadata: input.metadata,
  })
}

const ACTIVITY_IMAGE_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
}

async function cleanupStoredImage(input: {
  scope: AuthorizedMediaScope
  pathname: string | null
  ludoId: string
  memberId: string
  activityId: string
  operation: string
}) {
  if (!input.pathname) return
  try {
    await deletePublicSiteMedia(input.scope, input.pathname)
  } catch (cause) {
    console.error('[public-activity] image cleanup failed', { activityId: input.activityId }, cause)
    await audit({
      action: 'public_activity.image_cleanup_failed',
      ludoId: input.ludoId,
      memberId: input.memberId,
      activityId: input.activityId,
      metadata: { operation: input.operation },
    })
  }
}

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireActivityContext(event)
  const [activities, sites] = await Promise.all([
    listPublicActivitiesForManagement(ludo.id),
    listSiteRowsWithOpeningHours(ludo.id),
  ])
  return { activities, sites }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo, member } = await requireActivityContext(event)
    const data = await event.request.formData()
    return run(async () => {
      const input = createInput(data)
      const activity = await createPublicActivity(ludo.id, member.id, input)
      await audit({
        action: 'public_activity.created',
        ludoId: ludo.id,
        memberId: member.id,
        activityId: activity.id,
        metadata: { ...targetMetadata(input), type: input.type },
      })
      return { success: true }
    })
  },

  update: async (event) => {
    const { ludo, member } = await requireActivityContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const input = updateInput(data)
      const activity = await updatePublicActivity(
        id,
        ludo.id,
        input,
        member.id,
        parseRevision(data),
      )
      await audit({
        action: 'public_activity.updated',
        ludoId: ludo.id,
        memberId: member.id,
        activityId: activity.id,
        metadata: { ...targetMetadata(input as PublicActivityTargeting), type: input.type },
      })
      return { success: true }
    })
  },

  publication: async (event) => {
    const { ludo, member } = await requireActivityContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const next = data.get('status')
      if (next !== 'published' && next !== 'hidden')
        throw new PublicActivityServiceError('Transition invalide.')
      const transition =
        next === 'published'
          ? await publishPublicActivity(id, ludo.id, member.id, revision)
          : await hidePublicActivity(id, ludo.id, member.id, revision)
      if (transition.changed) {
        await audit({
          action: next === 'published' ? 'public_activity.published' : 'public_activity.hidden',
          ludoId: ludo.id,
          memberId: member.id,
          activityId: transition.activity.id,
          metadata: { fromStatus: transition.previousStatus, toStatus: transition.activity.status },
        })
      }
      return { success: true }
    })
  },

  lifecycle: async (event) => {
    const { ludo, member } = await requireActivityContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const next = data.get('lifecycle')
      const transition =
        next === 'archived'
          ? await archivePublicActivity(id, ludo.id, member.id, revision)
          : next === 'trashed'
            ? await trashPublicActivity(id, ludo.id, member.id, revision)
            : next === 'active'
              ? await restorePublicActivity(id, ludo.id, member.id, revision)
              : (() => {
                  throw new PublicActivityServiceError('Transition de cycle de vie invalide.')
                })()
      if (transition.changed) {
        await audit({
          action:
            next === 'active'
              ? 'public_activity.restored'
              : `public_activity.${next === 'trashed' ? 'trashed' : next}`,
          ludoId: ludo.id,
          memberId: member.id,
          activityId: transition.activity.id,
          metadata: {
            fromLifecycle: transition.previousLifecycle,
            toLifecycle: transition.activity.lifecycle,
          },
        })
      }
      return { success: true }
    })
  },

  feature: async (event) => {
    const { ludo, member } = await requireActivityContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const raw = String(data.get('rank') ?? '')
      const rank = raw === '' ? null : Number(raw)
      const activity = await setPublicActivityFeaturedRank(
        id,
        ludo.id,
        member.id,
        parseRevision(data),
        rank,
      )
      await audit({
        action: 'public_activity.featured_rank_updated',
        ludoId: ludo.id,
        memberId: member.id,
        activityId: activity.id,
        metadata: { rank },
      })
      return { success: true }
    })
  },

  delete: async (event) => {
    const { ludo, member } = await requireActivityContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const [scope, activity] = await Promise.all([
        authorizePublicActivityMediaScope(ludo.id, id, revision),
        getPublicActivity(id, ludo.id),
      ])
      await permanentlyDeletePublicActivity(id, ludo.id, revision)
      await cleanupStoredImage({
        scope,
        pathname: activity.imageStorageKey,
        ludoId: ludo.id,
        memberId: member.id,
        activityId: id,
        operation: 'delete',
      })
      await audit({
        action: 'public_activity.deleted',
        ludoId: ludo.id,
        memberId: member.id,
        activityId: id,
      })
      return { success: true }
    })
  },

  uploadImage: async (event) => {
    const { ludo, member } = await requireActivityContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const file = data.get('file')
      const alt = String(data.get('alt') ?? '').trim()
      if (!(file instanceof File)) throw new MediaStorageError('Sélectionnez une image.')
      if (!alt || alt.length > 300)
        throw new PublicActivityServiceError('Le texte alternatif est invalide.')
      const registered = await uploadAndRegisterMedia({
        authorize: () => authorizePublicActivityMediaScope(ludo.id, id, revision),
        upload: (scope) => uploadPublicSiteMedia({ scope, file, policy: ACTIVITY_IMAGE_POLICY }),
        register: async (scope, blob) => ({
          scope,
          result: await setPublicActivityImage(ludo.id, id, member.id, revision, scope, blob, alt),
        }),
        cleanup: deletePublicSiteMedia,
      })
      await cleanupStoredImage({
        scope: registered.scope,
        pathname: registered.result.previousStorageKey,
        ludoId: ludo.id,
        memberId: member.id,
        activityId: id,
        operation: 'replace',
      })
      await audit({
        action: 'public_activity.image_updated',
        ludoId: ludo.id,
        memberId: member.id,
        activityId: id,
      })
      return { success: true }
    })
  },

  removeImage: async (event) => {
    const { ludo, member } = await requireActivityContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const scope = await authorizePublicActivityMediaScope(ludo.id, id, revision)
      const result = await clearPublicActivityImage(ludo.id, id, member.id, revision)
      await cleanupStoredImage({
        scope,
        pathname: result.previousStorageKey,
        ludoId: ludo.id,
        memberId: member.id,
        activityId: id,
        operation: 'remove',
      })
      await audit({
        action: 'public_activity.image_removed',
        ludoId: ludo.id,
        memberId: member.id,
        activityId: id,
      })
      return { success: true }
    })
  },
}
