import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
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
  authorizePublicNewsMediaScope,
  clearPublicNewsImage,
  createPublicNews,
  hidePublicNews,
  listPublicNewsForManagement,
  publishPublicNews,
  PublicNewsServiceError,
  setPublicNewsImage,
  type PublicNewsInput,
  type PublicNewsTargeting,
  type PublicNewsUpdateInput,
  updatePublicNews,
} from '$lib/server/services/public-news.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import type { Actions, PageServerLoad } from './$types'

async function requireNewsContext(event: RequestEvent) {
  const context = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(context.ludo.id))) throw error(404, 'Module indisponible')
  return context
}

function targetingInput(data: FormData): PublicNewsTargeting {
  const targetMode = data.get('targetMode')
  const siteIds = data.getAll('siteIds').map(String)
  if (targetMode === 'all') {
    if (siteIds.length > 0) {
      throw new PublicNewsServiceError('Le ciblage de tous les lieux ne prend pas de lieu précis.')
    }
    return { targetMode, siteIds: [] }
  }
  if (targetMode === 'explicit') {
    if (siteIds.length === 0)
      throw new PublicNewsServiceError('Sélectionnez au moins un lieu actif.')
    return { targetMode, siteIds }
  }
  throw new PublicNewsServiceError('Choisissez le mode de ciblage de l’actualité.')
}

function createInput(data: FormData): PublicNewsInput {
  return {
    slug: String(data.get('slug') ?? ''),
    title: String(data.get('title') ?? ''),
    summary: String(data.get('summary') ?? ''),
    body: String(data.get('body') ?? '').replace(/\r\n?/g, '\n'),
    ...targetingInput(data),
  }
}

function updateInput(data: FormData): PublicNewsUpdateInput {
  return {
    ...(data.has('slug') ? { slug: String(data.get('slug') ?? '') } : {}),
    title: String(data.get('title') ?? ''),
    summary: String(data.get('summary') ?? ''),
    body: String(data.get('body') ?? '').replace(/\r\n?/g, '\n'),
    ...targetingInput(data),
  }
}

function parseRevision(data: FormData) {
  const revision = Number(data.get('revision'))
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new PublicNewsServiceError('La version de l’actualité est invalide. Rechargez la page.')
  }
  return revision
}

function targetMetadata(targeting: PublicNewsTargeting) {
  return { targetMode: targeting.targetMode, targetSiteIds: targeting.siteIds }
}

async function run(action: () => Promise<unknown>) {
  try {
    return await action()
  } catch (cause) {
    if (
      cause instanceof PublicNewsServiceError ||
      cause instanceof PublicSiteServiceError ||
      cause instanceof MediaStorageError
    ) {
      return fail(400, { error: cause.message })
    }
    if (cause instanceof MediaCompensationError) {
      return fail(500, { error: cause.message })
    }
    throw cause
  }
}

const NEWS_IMAGE_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
}

function parseImageFile(data: FormData) {
  const file = data.get('file')
  if (!(file instanceof File)) throw new MediaStorageError('Sélectionnez une image.')
  return file
}

function parseImageAlt(data: FormData) {
  const alt = String(data.get('alt') ?? '').trim()
  if (!alt || alt.length > 300) {
    throw new PublicNewsServiceError('Le texte alternatif doit contenir entre 1 et 300 caractères.')
  }
  return alt
}

async function cleanupPreviousImage(input: {
  scope: AuthorizedMediaScope
  pathname: string | null
  ludoId: string
  memberId: string
  newsId: string
  operation: 'replace' | 'remove'
}) {
  if (!input.pathname) return
  try {
    await deletePublicSiteMedia(input.scope, input.pathname)
  } catch (cause) {
    console.error('[public-news] previous image cleanup failed', { newsId: input.newsId }, cause)
    await emitAuditEvent({
      action: 'public_news.image_cleanup_failed',
      actorLudoId: input.ludoId,
      actorMemberId: input.memberId,
      entityType: 'public_news',
      entityId: input.newsId,
      metadata: { operation: input.operation },
    })
  }
}

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireNewsContext(event)
  const [news, sites] = await Promise.all([
    listPublicNewsForManagement(ludo.id),
    listSiteRowsWithOpeningHours(ludo.id),
  ])
  return { news, sites }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo, member } = await requireNewsContext(event)
    const data = await event.request.formData()
    return run(async () => {
      const input = createInput(data)
      const news = await createPublicNews(ludo.id, member.id, input)
      await emitAuditEvent({
        action: 'public_news.created',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: news.id,
        metadata: targetMetadata(input),
      })
      return { success: true }
    })
  },

  update: async (event) => {
    const { ludo, member } = await requireNewsContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const input = updateInput(data)
      const news = await updatePublicNews(id, ludo.id, input, member.id, parseRevision(data))
      await emitAuditEvent({
        action: 'public_news.updated',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: news.id,
        metadata: targetMetadata(input as PublicNewsTargeting),
      })
      return { success: true }
    })
  },

  transition: async (event) => {
    const { ludo, member } = await requireNewsContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    const nextStatus = data.get('status')
    return run(async () => {
      const revision = parseRevision(data)
      if (nextStatus !== 'published' && nextStatus !== 'hidden') {
        throw new PublicNewsServiceError('Transition de publication invalide.')
      }
      const transition =
        nextStatus === 'published'
          ? await publishPublicNews(id, ludo.id, member.id, revision)
          : await hidePublicNews(id, ludo.id, member.id, revision)
      if (transition.changed) {
        await emitAuditEvent({
          action: nextStatus === 'published' ? 'public_news.published' : 'public_news.hidden',
          actorLudoId: ludo.id,
          actorMemberId: member.id,
          entityType: 'public_news',
          entityId: transition.news.id,
          metadata: {
            fromStatus: transition.previousStatus,
            toStatus: transition.news.status,
          },
        })
      }
      return { success: true }
    })
  },

  uploadImage: async (event) => {
    const { ludo, member } = await requireNewsContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const file = parseImageFile(data)
      const alt = parseImageAlt(data)
      const registered = await uploadAndRegisterMedia({
        authorize: () => authorizePublicNewsMediaScope(ludo.id, id, revision),
        upload: (scope) => uploadPublicSiteMedia({ scope, file, policy: NEWS_IMAGE_POLICY }),
        register: async (scope, blob) => ({
          scope,
          result: await setPublicNewsImage(ludo.id, id, member.id, revision, scope, blob, alt),
        }),
        cleanup: deletePublicSiteMedia,
      })
      await cleanupPreviousImage({
        scope: registered.scope,
        pathname: registered.result.previousStorageKey,
        ludoId: ludo.id,
        memberId: member.id,
        newsId: id,
        operation: 'replace',
      })
      await emitAuditEvent({
        action: 'public_news.image_updated',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: registered.result.news.id,
        metadata: { hadPreviousImage: Boolean(registered.result.previousStorageKey) },
      })
      return { success: true }
    })
  },

  removeImage: async (event) => {
    const { ludo, member } = await requireNewsContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const scope = await authorizePublicNewsMediaScope(ludo.id, id, revision)
      const result = await clearPublicNewsImage(ludo.id, id, member.id, revision)
      await cleanupPreviousImage({
        scope,
        pathname: result.previousStorageKey,
        ludoId: ludo.id,
        memberId: member.id,
        newsId: id,
        operation: 'remove',
      })
      await emitAuditEvent({
        action: 'public_news.image_removed',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: result.news.id,
      })
      return { success: true }
    })
  },
}
