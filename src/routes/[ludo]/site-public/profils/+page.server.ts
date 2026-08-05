import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { getActiveMembersByLudo } from '$lib/server/db/members.js'
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
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import {
  authorizePublicProfileMediaScope,
  clearPublicProfilePhoto,
  createPublicProfile,
  deleteDraftPublicProfile,
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
function targets(d: FormData) {
  const targetMode = d.get('targetMode'),
    siteIds = d.getAll('siteIds').map(String)
  if (targetMode === 'all') {
    if (siteIds.length) throw new PublicProfileServiceError('Ciblage invalide.')
    return { targetMode, siteIds: [] } as const
  }
  if (targetMode === 'explicit') {
    if (!siteIds.length) throw new PublicProfileServiceError('Sélectionnez un lieu actif.')
    return { targetMode, siteIds } as const
  }
  throw new PublicProfileServiceError('Ciblage requis.')
}
function section(d: FormData): PublicProfileInput['section'] {
  const v = d.get('section')
  if (v !== 'team' && v !== 'committee') throw new PublicProfileServiceError('Section invalide.')
  return v
}
function input(d: FormData): PublicProfileInput {
  return {
    memberId: String(d.get('memberId') ?? '').trim() || null,
    section: section(d),
    displayName: String(d.get('displayName') ?? ''),
    roleTitle: String(d.get('roleTitle') ?? '').trim() || null,
    bioMarkdown: String(d.get('bioMarkdown') ?? '').trim() || null,
    sortOrder: Number(d.get('sortOrder')),
    ...targets(d),
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
export const load: PageServerLoad = async (e) => {
  const { ludo } = await context(e)
  const [profiles, sites, rows] = await Promise.all([
    listPublicProfilesForManagement(ludo.id),
    listSiteRowsWithOpeningHours(ludo.id),
    getActiveMembersByLudo(ludo.id),
  ])
  return { profiles, sites, members: rows.map((x) => ({ id: x.id, displayName: x.name })) }
}
export const actions: Actions = {
  create: async (e) => {
    const { ludo, member } = await context(e),
      d = await e.request.formData()
    return run(async () => {
      const x = input(d),
        p = await createPublicProfile(ludo.id, member.id, x)
      await audit('public_profile.created', ludo.id, member.id, p.id, {
        section: x.section,
        sortOrder: x.sortOrder,
        targetMode: x.targetMode,
        targetSiteIds: x.siteIds,
        hasMemberLink: x.memberId !== null,
        hasRole: x.roleTitle !== null,
        hasBio: x.bioMarkdown !== null,
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
        p = await updatePublicProfile(id, ludo.id, x, member.id, rev(d))
      await audit('public_profile.updated', ludo.id, member.id, p.id, {
        section: x.section,
        sortOrder: x.sortOrder,
        targetMode: x.targetMode,
        targetSiteIds: x.siteIds,
        hasMemberLink: x.memberId !== null,
        hasRole: x.roleTitle !== null,
        hasBio: x.bioMarkdown !== null,
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
        x = await deleteDraftPublicProfile(id, ludo.id, r)
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
