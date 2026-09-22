import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit'
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
  addPublicPdfAttachment,
  deletePublicEditorialAsset,
  PublicEditorialAssetServiceError,
} from '$lib/server/services/public-editorial-assets.js'
import {
  authorizePublicNewsMediaScope,
  clearPublicNewsImage,
  createPublicNews,
  permanentlyDeletePublicNews,
  getPublicNews,
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
    slug: String(data.get('slug') || data.get('title') || ''),
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
    ...(data.has('targetMode') ? targetingInput(data) : {}),
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
      cause instanceof PublicEditorialAssetServiceError ||
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

const NEWS_PDF_POLICY = {
  maxBytes: 15 * 1024 * 1024,
  allowedTypes: ['application/pdf'] as const,
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

function optionalFile(data: FormData, name: string, label: string) {
  const value = data.get(name)
  if (value == null) return null
  if (!(value instanceof File)) throw new MediaStorageError(`Sélectionnez ${label}.`)
  return value.size > 0 ? value : null
}

function requiredText(data: FormData, name: string, label: string, maxLength: number) {
  const value = String(data.get(name) ?? '').trim()
  if (!value || value.length > maxLength) {
    throw new PublicNewsServiceError(`${label} doit contenir entre 1 et ${maxLength} caractères.`)
  }
  return value
}

function shouldBeVisible(data: FormData) {
  return data.get('visible') === 'true'
}

async function cleanupPreviousImage(input: {
  scope: AuthorizedMediaScope
  pathname: string | null
  ludoId: string
  memberId: string
  newsId: string
  operation: 'replace' | 'remove' | 'asset-remove' | 'delete'
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

async function applyNewsMedia(input: {
  data: FormData
  ludoId: string
  memberId: string
  news: Awaited<ReturnType<typeof getPublicNews>>
}) {
  const { data, ludoId, memberId } = input
  let news = input.news
  const cover = optionalFile(data, 'coverFile', 'une image de couverture')
  if (cover) {
    const alt = requiredText(data, 'coverAlt', 'Le texte alternatif de l’image', 300)
    const registered = await uploadAndRegisterMedia({
      authorize: () => authorizePublicNewsMediaScope(ludoId, news.id, news.revision),
      upload: (scope) => uploadPublicSiteMedia({ scope, file: cover, policy: NEWS_IMAGE_POLICY }),
      register: async (scope, blob) => ({
        scope,
        result: await setPublicNewsImage(
          ludoId,
          news.id,
          memberId,
          news.revision,
          scope,
          blob,
          alt,
        ),
      }),
      cleanup: deletePublicSiteMedia,
    })
    await cleanupPreviousImage({
      scope: registered.scope,
      pathname: registered.result.previousStorageKey,
      ludoId,
      memberId,
      newsId: news.id,
      operation: 'replace',
    })
    news = registered.result.news
  } else if (data.get('removeCover') === 'on') {
    const scope = await authorizePublicNewsMediaScope(ludoId, news.id, news.revision)
    const result = await clearPublicNewsImage(ludoId, news.id, memberId, news.revision)
    await cleanupPreviousImage({
      scope,
      pathname: result.previousStorageKey,
      ludoId,
      memberId,
      newsId: news.id,
      operation: 'remove',
    })
    news = result.news
  }

  const attachment = optionalFile(data, 'attachmentFile', 'un PDF')
  if (attachment) {
    const title = requiredText(data, 'attachmentTitle', 'Le titre du PDF', 500)
    await uploadAndRegisterMedia({
      authorize: () => authorizePublicNewsMediaScope(ludoId, news.id, news.revision),
      upload: (scope) =>
        uploadPublicSiteMedia({ scope, file: attachment, policy: NEWS_PDF_POLICY }),
      register: (scope, blob) =>
        addPublicPdfAttachment({
          ludoId,
          owner: { type: 'news', id: news.id },
          memberId,
          scope,
          blob,
          title,
          fileName: attachment.name,
        }),
      cleanup: deletePublicSiteMedia,
    })
  }

  for (const assetId of data.getAll('removeAssetIds').map(String)) {
    const scope = await authorizePublicNewsMediaScope(ludoId, news.id, news.revision)
    const asset = await deletePublicEditorialAsset(assetId, ludoId, { type: 'news', id: news.id })
    await cleanupPreviousImage({
      scope,
      pathname: asset.storageKey,
      ludoId,
      memberId,
      newsId: news.id,
      operation: 'asset-remove',
    })
  }
  return news
}

async function applyNewsVisibility(input: {
  news: Awaited<ReturnType<typeof getPublicNews>>
  ludoId: string
  memberId: string
  visible: boolean
}) {
  let news = input.news
  if (input.visible && news.status !== 'published') {
    news = (await publishPublicNews(news.id, input.ludoId, input.memberId, news.revision)).news
  }
  if (!input.visible && news.status !== 'hidden') {
    if (news.status === 'draft') {
      news = (await publishPublicNews(news.id, input.ludoId, input.memberId, news.revision)).news
    }
    news = (await hidePublicNews(news.id, input.ludoId, input.memberId, news.revision)).news
  }
  return news
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
      let news = await createPublicNews(ludo.id, member.id, input)
      news = await applyNewsMedia({ data, ludoId: ludo.id, memberId: member.id, news })
      news = await applyNewsVisibility({
        news,
        ludoId: ludo.id,
        memberId: member.id,
        visible: shouldBeVisible(data),
      })
      await emitAuditEvent({
        action: 'public_news.created',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: news.id,
        metadata: { ...targetMetadata(input), visible: news.status === 'published' },
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
      let news = await updatePublicNews(id, ludo.id, input, member.id, parseRevision(data))
      news = await applyNewsMedia({ data, ludoId: ludo.id, memberId: member.id, news })
      news = await applyNewsVisibility({
        news,
        ludoId: ludo.id,
        memberId: member.id,
        visible: shouldBeVisible(data),
      })
      await emitAuditEvent({
        action: 'public_news.updated',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: news.id,
        metadata: {
          ...targetMetadata(input as PublicNewsTargeting),
          visible: news.status === 'published',
        },
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

  delete: async (event) => {
    const { ludo, member } = await requireNewsContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const [scope, news] = await Promise.all([
        authorizePublicNewsMediaScope(ludo.id, id, revision),
        getPublicNews(id, ludo.id),
      ])
      await permanentlyDeletePublicNews(id, ludo.id, revision)
      const storedPaths = [
        news.imageStorageKey,
        ...(news.assets ?? []).map((asset) => asset.storageKey),
      ].filter((pathname): pathname is string => Boolean(pathname))
      await Promise.all(
        storedPaths.map((pathname) =>
          cleanupPreviousImage({
            scope,
            pathname,
            ludoId: ludo.id,
            memberId: member.id,
            newsId: id,
            operation: 'delete',
          }),
        ),
      )
      await emitAuditEvent({
        action: 'public_news.deleted',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: id,
      })
      throw redirect(303, `/${ludo.slug}/site-public/actualites`)
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

  uploadAttachment: async (event) => {
    const { ludo, member } = await requireNewsContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = parseRevision(data)
      const file = data.get('file')
      if (!(file instanceof File)) throw new MediaStorageError('Sélectionnez un PDF.')
      const title = String(data.get('title') ?? '')
      const asset = await uploadAndRegisterMedia({
        authorize: () => authorizePublicNewsMediaScope(ludo.id, id, revision),
        upload: (scope) => uploadPublicSiteMedia({ scope, file, policy: NEWS_PDF_POLICY }),
        register: (scope, blob) =>
          addPublicPdfAttachment({
            ludoId: ludo.id,
            owner: { type: 'news', id },
            memberId: member.id,
            scope,
            blob,
            title,
            fileName: file.name,
          }),
        cleanup: deletePublicSiteMedia,
      })
      await emitAuditEvent({
        action: 'public_news.attachment_added',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: id,
        metadata: { assetId: asset.id },
      })
      return { success: true }
    })
  },

  deleteAsset: async (event) => {
    const { ludo, member } = await requireNewsContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    const assetId = String(data.get('assetId') ?? '')
    return run(async () => {
      const scope = await authorizePublicNewsMediaScope(ludo.id, id, parseRevision(data))
      const asset = await deletePublicEditorialAsset(assetId, ludo.id, { type: 'news', id })
      await cleanupPreviousImage({
        scope,
        pathname: asset.storageKey,
        ludoId: ludo.id,
        memberId: member.id,
        newsId: id,
        operation: 'asset-remove',
      })
      await emitAuditEvent({
        action: 'public_news.asset_removed',
        actorLudoId: ludo.id,
        actorMemberId: member.id,
        entityType: 'public_news',
        entityId: id,
        metadata: { assetId, kind: asset.kind },
      })
      return { success: true }
    })
  },
}
