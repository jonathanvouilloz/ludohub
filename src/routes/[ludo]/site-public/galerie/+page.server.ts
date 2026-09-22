import { error, fail, type RequestEvent } from '@sveltejs/kit'
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
  createPublicGalleryImage,
  permanentlyDeletePublicGalleryImage,
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
function createInput(d: FormData): PublicGalleryInput {
  const caption = String(d.get('caption') ?? '').trim()
  if (!caption) throw new PublicGalleryServiceError('Ajoutez une légende.')
  return {
    caption,
    alt: caption,
    sortOrder: 0,
    targetMode: 'all',
    siteIds: [],
  }
}
function updateInput(d: FormData) {
  const caption = String(d.get('caption') ?? '').trim()
  if (!caption) throw new PublicGalleryServiceError('Ajoutez une légende.')
  return { caption, alt: caption }
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
  return { galleryItems: await listPublicGalleryForManagement(ludo.id) }
}
export const actions: Actions = {
  create: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData()
    return run(async () => {
      const x = createInput(d),
        file = d.get('file')
      if (!(file instanceof File) || file.size < 1)
        throw new MediaStorageError('Sélectionnez une image.')
      const item = await createPublicGalleryImage(ludo.id, member.id, x)
      const registered = await uploadAndRegisterMedia({
        authorize: () => authorizePublicGalleryMediaScope(ludo.id, item.id, item.revision),
        upload: (scope) => uploadPublicSiteMedia({ scope, file, policy: POLICY }),
        register: async (scope, blob) => ({
          scope,
          result: await setPublicGalleryImageFile(
            ludo.id,
            item.id,
            member.id,
            item.revision,
            scope,
            blob,
            x.alt ?? x.caption ?? '',
          ),
        }),
        cleanup: deletePublicSiteMedia,
      })
      await publishPublicGalleryImage(
        item.id,
        ludo.id,
        member.id,
        registered.result.image.revision,
      )
      await audit('public_gallery.created', ludo.id, member.id, item.id, {
        hasCaption: true,
        uploaded: true,
      })
      return { success: true }
    })
  },
  update: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const x = updateInput(d),
        item = await updatePublicGalleryImage(id, ludo.id, x, member.id, rev(d))
      await audit('public_gallery.updated', ludo.id, member.id, item.id, {
        hasCaption: true,
      })
      return { success: true }
    })
  },
  publication: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const t = await publishPublicGalleryImage(id, ludo.id, member.id, rev(d))
      if (t.changed) await audit('public_gallery.published', ludo.id, member.id, t.image.id)
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
        x = await permanentlyDeletePublicGalleryImage(id, ludo.id, r)
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
        alt = String(d.get('caption') ?? '').trim()
      if (!(file instanceof File)) throw new MediaStorageError('Sélectionnez une image.')
      if (!alt || alt.length > 300) throw new PublicGalleryServiceError('Ajoutez une légende.')
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
}
