import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import {
  deletePublicSiteMedia,
  MediaStorageError,
  uploadPublicSiteMedia,
} from '$lib/server/media/blob-storage.js'
import { MediaCompensationError, uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import type { AuthorizedMediaScope } from '$lib/server/media/paths.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import {
  authorizePublicGalleryMediaScope,
  clearPublicGalleryImageFile,
  createPublicGalleryImage,
  deleteDraftPublicGalleryImage,
  hidePublicGalleryImage,
  listPublicGalleryForManagement,
  publishPublicGalleryImage,
  PublicGalleryServiceError,
  setPublicGalleryImageFile,
  type PublicGalleryInput,
  updatePublicGalleryImage,
} from '$lib/server/services/public-gallery.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import type { Actions, PageServerLoad } from './$types'
async function context(e: RequestEvent) {
  const c = await requireLudoContext(e)
  if (!(await isPublicSiteEnabled(c.ludo.id))) throw error(404, 'Module indisponible')
  return c
}
function targets(d: FormData) {
  const targetMode = d.get('targetMode'),
    siteIds = d.getAll('siteIds').map(String)
  if (targetMode === 'all') {
    if (siteIds.length) throw new PublicGalleryServiceError('Ciblage invalide.')
    return { targetMode, siteIds: [] } as const
  }
  if (targetMode === 'explicit') {
    if (!siteIds.length) throw new PublicGalleryServiceError('Sélectionnez un lieu actif.')
    return { targetMode, siteIds } as const
  }
  throw new PublicGalleryServiceError('Ciblage requis.')
}
function input(d: FormData): PublicGalleryInput {
  return {
    caption: String(d.get('caption') ?? '').trim() || null,
    alt: String(d.get('alt') ?? '').trim() || null,
    sortOrder: Number(d.get('sortOrder')),
    ...targets(d),
  }
}
function rev(d: FormData) {
  const v = Number(d.get('revision'))
  if (!Number.isSafeInteger(v) || v < 1) throw new PublicGalleryServiceError('Révision invalide.')
  return v
}
async function run(f: () => Promise<unknown>) {
  try {
    return await f()
  } catch (c) {
    if (
      c instanceof PublicGalleryServiceError ||
      c instanceof PublicSiteServiceError ||
      c instanceof MediaStorageError
    )
      return fail(400, { error: c.message })
    if (c instanceof MediaCompensationError) return fail(500, { error: c.message })
    throw c
  }
}
async function audit(
  action: string,
  l: string,
  m: string,
  id: string,
  metadata?: Record<string, unknown>,
) {
  await emitAuditEvent({
    action,
    actorLudoId: l,
    actorMemberId: m,
    entityType: 'public_gallery_image',
    entityId: id,
    metadata,
  })
}
async function cleanup(
  s: AuthorizedMediaScope,
  path: string | null,
  l: string,
  m: string,
  id: string,
  operation: string,
) {
  if (!path) return
  try {
    await deletePublicSiteMedia(s, path)
  } catch (c) {
    console.error('[public-gallery] cleanup failed', { id }, c)
    await audit('public_gallery.image_cleanup_failed', l, m, id, { operation })
  }
}
const POLICY = {
  maxBytes: 8 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
}
export const load: PageServerLoad = async (e) => {
  const { ludo } = await context(e)
  const [galleryItems, sites] = await Promise.all([
    listPublicGalleryForManagement(ludo.id),
    listSiteRowsWithOpeningHours(ludo.id),
  ])
  return { galleryItems, sites }
}
export const actions: Actions = {
  create: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData()
    return run(async () => {
      const x = input(d),
        item = await createPublicGalleryImage(ludo.id, member.id, x)
      await audit('public_gallery.created', ludo.id, member.id, item.id, {
        sortOrder: x.sortOrder,
        targetMode: x.targetMode,
        targetSiteIds: x.siteIds,
        hasCaption: x.caption !== null,
        hasAlt: x.alt !== null,
      })
      return { success: true }
    })
  },
  update: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const x = input(d),
        item = await updatePublicGalleryImage(id, ludo.id, x, member.id, rev(d))
      await audit('public_gallery.updated', ludo.id, member.id, item.id, {
        sortOrder: x.sortOrder,
        targetMode: x.targetMode,
        targetSiteIds: x.siteIds,
        hasCaption: x.caption !== null,
        hasAlt: x.alt !== null,
      })
      return { success: true }
    })
  },
  publication: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const next = d.get('status')
      if (next !== 'published' && next !== 'hidden')
        throw new PublicGalleryServiceError('Transition invalide.')
      const t =
        next === 'published'
          ? await publishPublicGalleryImage(id, ludo.id, member.id, rev(d))
          : await hidePublicGalleryImage(id, ludo.id, member.id, rev(d))
      if (t.changed)
        await audit(
          next === 'published' ? 'public_gallery.published' : 'public_gallery.hidden',
          ludo.id,
          member.id,
          t.image.id,
          { fromStatus: t.previousStatus, toStatus: t.image.status },
        )
      return { success: true }
    })
  },
  delete: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const r = rev(d),
        s = await authorizePublicGalleryMediaScope(ludo.id, id, r),
        x = await deleteDraftPublicGalleryImage(id, ludo.id, r)
      await cleanup(s, x.previousStorageKey, ludo.id, member.id, id, 'delete')
      await audit('public_gallery.deleted', ludo.id, member.id, id)
      return { success: true }
    })
  },
  uploadImage: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const r = rev(d),
        file = d.get('file'),
        alt = String(d.get('alt') ?? '').trim()
      if (!(file instanceof File)) throw new MediaStorageError('Sélectionnez une image.')
      if (!alt || alt.length > 300)
        throw new PublicGalleryServiceError('Le texte alternatif est requis pour cette image.')
      const registered = await uploadAndRegisterMedia({
        authorize: () => authorizePublicGalleryMediaScope(ludo.id, id, r),
        upload: (s) => uploadPublicSiteMedia({ scope: s, file, policy: POLICY }),
        register: async (s, b) => ({
          scope: s,
          result: await setPublicGalleryImageFile(ludo.id, id, member.id, r, s, b, alt),
        }),
        cleanup: deletePublicSiteMedia,
      })
      await cleanup(
        registered.scope,
        registered.result.previousStorageKey,
        ludo.id,
        member.id,
        id,
        'replace',
      )
      await audit('public_gallery.image_updated', ludo.id, member.id, id)
      return { success: true }
    })
  },
  removeImage: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const r = rev(d),
        s = await authorizePublicGalleryMediaScope(ludo.id, id, r),
        x = await clearPublicGalleryImageFile(ludo.id, id, member.id, r)
      await cleanup(s, x.previousStorageKey, ludo.id, member.id, id, 'remove')
      await audit('public_gallery.image_removed', ludo.id, member.id, id)
      return { success: true }
    })
  },
}
