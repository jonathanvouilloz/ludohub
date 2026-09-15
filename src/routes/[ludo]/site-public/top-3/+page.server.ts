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
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import {
  createPublicTopThree,
  authorizePublicTopThreeMediaScope,
  clearPublicTopThreeGameImage,
  deselectPublicTopThreeFromHomepage,
  permanentlyDeletePublicTopThree,
  hidePublicTopThree,
  getPublicTopThree,
  listPublicTopThreesForManagement,
  publishPublicTopThree,
  selectPublicTopThreeForHomepage,
  setPublicTopThreeGameImage,
  PublicTopThreeServiceError,
  type PublicTopThreeInput,
  type PublicTopThreeTargeting,
  type PublicTopThreeUpdateInput,
  updatePublicTopThree,
} from '$lib/server/services/public-top-threes.js'
import type { Actions, PageServerLoad } from './$types'

type TopThreeGameInput = { name: string; description?: string }

async function requireTopThreeContext(event: RequestEvent) {
  const context = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(context.ludo.id))) throw error(404, 'Module indisponible')
  return context
}

function targetingInput(data: FormData): PublicTopThreeTargeting {
  const targetMode = data.get('targetMode')
  const siteIds = data.getAll('siteIds').map(String)
  if (targetMode === 'all') {
    if (siteIds.length)
      throw new PublicTopThreeServiceError('Le ciblage global ne prend pas de lieu précis.')
    return { targetMode, siteIds: [] }
  }
  if (targetMode === 'explicit') {
    if (!siteIds.length)
      throw new PublicTopThreeServiceError('Sélectionnez au moins un lieu actif.')
    return { targetMode, siteIds }
  }
  throw new PublicTopThreeServiceError('Choisissez le mode de ciblage du Top 3.')
}

function gamesInput(data: FormData): TopThreeGameInput[] {
  try {
    const games = JSON.parse(String(data.get('games') ?? ''))
    if (!Array.isArray(games)) throw new Error()
    return games as TopThreeGameInput[]
  } catch {
    throw new PublicTopThreeServiceError('Les trois jeux sont invalides.')
  }
}

function createInput(data: FormData): PublicTopThreeInput {
  return {
    slug: String(data.get('slug') ?? ''),
    theme: String(data.get('theme') ?? ''),
    games: gamesInput(data),
    ...targetingInput(data),
  }
}

function updateInput(data: FormData): PublicTopThreeUpdateInput {
  return {
    theme: String(data.get('theme') ?? ''),
    games: gamesInput(data),
    ...(data.has('slug') ? { slug: String(data.get('slug') ?? '') } : { slug: undefined }),
    ...targetingInput(data),
  }
}

function revisionInput(data: FormData) {
  const revision = Number(data.get('revision'))
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new PublicTopThreeServiceError('La version du Top 3 est invalide. Rechargez la page.')
  }
  return revision
}

async function run(action: () => Promise<unknown>) {
  try {
    return await action()
  } catch (cause) {
    if (
      cause instanceof PublicTopThreeServiceError ||
      cause instanceof PublicSiteServiceError ||
      cause instanceof MediaStorageError
    ) {
      return fail(400, { error: cause.message })
    }
    if (cause instanceof MediaCompensationError) return fail(500, { error: cause.message })
    throw cause
  }
}

const TOP_GAME_IMAGE_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
}

function imageInput(data: FormData) {
  const file = data.get('file')
  if (!(file instanceof File)) throw new MediaStorageError('Sélectionnez une image.')
  const alt = String(data.get('alt') ?? '').trim()
  if (!alt || alt.length > 300) {
    throw new PublicTopThreeServiceError(
      'Le texte alternatif doit contenir entre 1 et 300 caractères.',
    )
  }
  const index = Number(data.get('gameIndex'))
  if (!Number.isSafeInteger(index) || index < 0 || index > 2) {
    throw new PublicTopThreeServiceError('La position du jeu est invalide.')
  }
  return { file, alt, index }
}

async function cleanupTopGameImage(input: {
  scope: AuthorizedMediaScope
  pathname: string | null
  ludoId: string
  memberId: string
  topThreeId: string
  operation: 'replace' | 'remove' | 'delete'
}) {
  if (!input.pathname) return
  try {
    await deletePublicSiteMedia(input.scope, input.pathname)
  } catch (cause) {
    console.error(
      '[public-top-three] image cleanup failed',
      { topThreeId: input.topThreeId },
      cause,
    )
    await audit({
      action: 'public_top_three.image_cleanup_failed',
      ludoId: input.ludoId,
      memberId: input.memberId,
      topThreeId: input.topThreeId,
      metadata: { operation: input.operation },
    })
  }
}

async function audit(input: {
  action: string
  ludoId: string
  memberId: string
  topThreeId: string
  metadata?: Record<string, unknown>
}) {
  await emitAuditEvent({
    action: input.action,
    actorLudoId: input.ludoId,
    actorMemberId: input.memberId,
    entityType: 'public_top_three',
    entityId: input.topThreeId,
    metadata: input.metadata,
  })
}

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireTopThreeContext(event)
  const [topThrees, sites] = await Promise.all([
    listPublicTopThreesForManagement(ludo.id),
    listSiteRowsWithOpeningHours(ludo.id),
  ])
  return { topThrees, sites }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    return run(async () => {
      const input = createInput(data)
      const topThree = await createPublicTopThree(ludo.id, member.id, input)
      await audit({
        action: 'public_top_three.created',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: topThree.id,
        metadata: {
          targetMode: input.targetMode,
          targetSiteIds: input.siteIds,
          gameCount: input.games.length,
        },
      })
      return { success: true }
    })
  },

  update: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const input = updateInput(data)
      const topThree = await updatePublicTopThree(
        id,
        ludo.id,
        input,
        member.id,
        revisionInput(data),
      )
      await audit({
        action: 'public_top_three.updated',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: topThree.id,
        metadata: {
          targetMode: input.targetMode,
          targetSiteIds: input.siteIds,
          gameCount: input.games?.length,
        },
      })
      return { success: true }
    })
  },

  publication: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const next = data.get('status')
      if (next !== 'published' && next !== 'hidden') {
        throw new PublicTopThreeServiceError('Transition invalide.')
      }
      const transition =
        next === 'published'
          ? await publishPublicTopThree(id, ludo.id, member.id, revisionInput(data))
          : await hidePublicTopThree(id, ludo.id, member.id, revisionInput(data))
      if (transition.changed) {
        await audit({
          action: next === 'published' ? 'public_top_three.published' : 'public_top_three.hidden',
          ludoId: ludo.id,
          memberId: member.id,
          topThreeId: transition.topThree.id,
          metadata: {
            fromStatus: transition.previousStatus,
            toStatus: transition.topThree.status,
          },
        })
      }
      return { success: true }
    })
  },

  homepage: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const next = data.get('isHomepage')
      if (next !== 'true' && next !== 'false') {
        throw new PublicTopThreeServiceError('Sélection d’accueil invalide.')
      }
      const selection =
        next === 'true'
          ? await selectPublicTopThreeForHomepage(id, ludo.id, member.id, revisionInput(data))
          : await deselectPublicTopThreeFromHomepage(id, ludo.id, member.id, revisionInput(data))
      if (selection.changed) {
        await audit({
          action: selection.topThree.isHomepage
            ? 'public_top_three.homepage_selected'
            : 'public_top_three.homepage_deselected',
          ludoId: ludo.id,
          memberId: member.id,
          topThreeId: selection.topThree.id,
          metadata: { isHomepage: selection.topThree.isHomepage },
        })
      }
      return { success: true }
    })
  },

  delete: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = revisionInput(data)
      const [scope, topThree] = await Promise.all([
        authorizePublicTopThreeMediaScope(ludo.id, id, revision),
        getPublicTopThree(id, ludo.id),
      ])
      await permanentlyDeletePublicTopThree(id, ludo.id, revision)
      await Promise.all(
        topThree.games.map((game) =>
          cleanupTopGameImage({
            scope,
            pathname: game.imageStorageKey ?? null,
            ludoId: ludo.id,
            memberId: member.id,
            topThreeId: id,
            operation: 'delete',
          }),
        ),
      )
      await audit({
        action: 'public_top_three.deleted',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
      })
      return { success: true }
    })
  },

  uploadGameImage: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = revisionInput(data)
      const { file, alt, index } = imageInput(data)
      const result = await uploadAndRegisterMedia({
        authorize: () => authorizePublicTopThreeMediaScope(ludo.id, id, revision),
        upload: (scope) => uploadPublicSiteMedia({ scope, file, policy: TOP_GAME_IMAGE_POLICY }),
        register: (scope, blob) =>
          setPublicTopThreeGameImage(ludo.id, id, member.id, revision, index, scope, blob, alt),
        cleanup: deletePublicSiteMedia,
      })
      await cleanupTopGameImage({
        scope: await authorizePublicTopThreeMediaScope(ludo.id, id, result.topThree.revision),
        pathname: result.previousStorageKey,
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
        operation: 'replace',
      })
      await audit({
        action: 'public_top_three.game_image_updated',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
        metadata: { position: index + 1, hadPreviousImage: Boolean(result.previousStorageKey) },
      })
      return { success: true }
    })
  },

  removeGameImage: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = revisionInput(data)
      const index = Number(data.get('gameIndex'))
      const scope = await authorizePublicTopThreeMediaScope(ludo.id, id, revision)
      const result = await clearPublicTopThreeGameImage(ludo.id, id, member.id, revision, index)
      await cleanupTopGameImage({
        scope,
        pathname: result.previousStorageKey,
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
        operation: 'remove',
      })
      await audit({
        action: 'public_top_three.game_image_removed',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
        metadata: { position: index + 1 },
      })
      return { success: true }
    })
  },
}
