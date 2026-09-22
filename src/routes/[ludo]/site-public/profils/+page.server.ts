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
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import {
  authorizePublicProfileMediaScope,
  clearPublicProfilePhoto,
  createPublicProfile,
  permanentlyDeletePublicProfile,
  hidePublicProfile,
  listPublicProfilesForManagement,
  publishPublicProfile,
  PublicProfileServiceError,
  setPublicProfilePhoto,
  type PublicProfileInput,
  updatePublicProfile,
} from '$lib/server/services/public-profiles.js'
import type { Actions, PageServerLoad } from './$types'
async function context(e: RequestEvent) {
  const c = await requireLudoContext(e)
  if (!(await isPublicSiteEnabled(c.ludo.id))) throw error(404, 'Module indisponible')
  return c
}
function section(d: FormData): PublicProfileInput['section'] {
  const v = d.get('section')
  if (v !== 'team' && v !== 'committee') throw new PublicProfileServiceError('Section invalide.')
  return v
}
function input(d: FormData): PublicProfileInput {
  return {
    section: section(d),
    displayName: String(d.get('displayName') ?? ''),
    roleTitle: String(d.get('roleTitle') ?? '').trim() || null,
    bioText: String(d.get('bioText') ?? '').trim() || null,
  }
}
function rev(d: FormData) {
  const v = Number(d.get('revision'))
  if (!Number.isSafeInteger(v) || v < 1) throw new PublicProfileServiceError('Révision invalide.')
  return v
}
async function run(f: () => Promise<unknown>) {
  try {
    return await f()
  } catch (c) {
    if (
      c instanceof PublicProfileServiceError ||
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
    entityType: 'public_profile',
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
    console.error('[public-profile] cleanup failed', { id }, c)
    await audit('public_profile.photo_cleanup_failed', l, m, id, { operation })
  }
}
const POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
}
async function applyPhoto(data: FormData, profile: Awaited<ReturnType<typeof createPublicProfile>>, ludoId: string, memberId: string) {
  const file = data.get('photoFile')
  if (file instanceof File && file.size > 0) {
    const registered = await uploadAndRegisterMedia({
      authorize: () => authorizePublicProfileMediaScope(ludoId, profile.id, profile.revision),
      upload: (scope) => uploadPublicSiteMedia({ scope, file, policy: POLICY }),
      register: async (scope, blob) => ({ scope, result: await setPublicProfilePhoto(ludoId, profile.id, memberId, profile.revision, scope, blob, profile.displayName) }),
      cleanup: deletePublicSiteMedia,
    })
    await cleanup(registered.scope, registered.result.previousStorageKey, ludoId, memberId, profile.id, 'replace')
    return registered.result.profile
  }
  if (data.get('removePhoto') === 'on' && profile.photoUrl) {
    const scope = await authorizePublicProfileMediaScope(ludoId, profile.id, profile.revision)
    const result = await clearPublicProfilePhoto(ludoId, profile.id, memberId, profile.revision)
    await cleanup(scope, result.previousStorageKey, ludoId, memberId, profile.id, 'remove')
    return result.profile
  }
  return profile
}
export const load: PageServerLoad = async (e) => {
  const { ludo } = await context(e)
  return { profiles: await listPublicProfilesForManagement(ludo.id) }
}
export const actions: Actions = {
  create: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData()
    return run(async () => {
      const x = input(d)
      let p = await createPublicProfile(ludo.id, member.id, x)
      p = await applyPhoto(d, p, ludo.id, member.id)
      await audit('public_profile.created', ludo.id, member.id, p.id, {
        section: x.section,
        hasRole: x.roleTitle !== null,
        hasBio: x.bioText !== null,
      })
      return { success: true }
    })
  },
  update: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const x = input(d)
      let p = await updatePublicProfile(id, ludo.id, x, member.id, rev(d))
      p = await applyPhoto(d, p, ludo.id, member.id)
      await audit('public_profile.updated', ludo.id, member.id, p.id, {
        section: x.section,
        hasRole: x.roleTitle !== null,
        hasBio: x.bioText !== null,
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
        throw new PublicProfileServiceError('Transition invalide.')
      const t =
        next === 'published'
          ? await publishPublicProfile(id, ludo.id, member.id, rev(d))
          : await hidePublicProfile(id, ludo.id, member.id, rev(d))
      if (t.changed)
        await audit(
          next === 'published' ? 'public_profile.published' : 'public_profile.hidden',
          ludo.id,
          member.id,
          t.profile.id,
          { fromStatus: t.previousStatus, toStatus: t.profile.status },
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
        s = await authorizePublicProfileMediaScope(ludo.id, id, r),
        x = await permanentlyDeletePublicProfile(id, ludo.id, r)
      await cleanup(s, x.previousStorageKey, ludo.id, member.id, id, 'delete')
      await audit('public_profile.deleted', ludo.id, member.id, id)
      return { success: true }
    })
  },
  uploadPhoto: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const r = rev(d),
        file = d.get('file'),
        alt = String(d.get('alt') ?? '').trim()
      if (!(file instanceof File)) throw new MediaStorageError('Sélectionnez une photo.')
      if (!alt || alt.length > 300)
        throw new PublicProfileServiceError('Le texte alternatif est requis.')
      const registered = await uploadAndRegisterMedia({
        authorize: () => authorizePublicProfileMediaScope(ludo.id, id, r),
        upload: (s) => uploadPublicSiteMedia({ scope: s, file, policy: POLICY }),
        register: async (s, b) => ({
          scope: s,
          result: await setPublicProfilePhoto(ludo.id, id, member.id, r, s, b, alt),
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
      await audit('public_profile.photo_updated', ludo.id, member.id, id)
      return { success: true }
    })
  },
  removePhoto: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData(),
      id = String(d.get('id') ?? '')
    return run(async () => {
      const r = rev(d),
        s = await authorizePublicProfileMediaScope(ludo.id, id, r),
        x = await clearPublicProfilePhoto(ludo.id, id, member.id, r)
      await cleanup(s, x.previousStorageKey, ludo.id, member.id, id, 'remove')
      await audit('public_profile.photo_removed', ludo.id, member.id, id)
      return { success: true }
    })
  },
}
