import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import {
  createPublicTopThree,
  deleteDraftPublicTopThree,
  hidePublicTopThree,
  listPublicTopThreesForManagement,
  publishPublicTopThree,
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
    if (cause instanceof PublicTopThreeServiceError || cause instanceof PublicSiteServiceError) {
      return fail(400, { error: cause.message })
    }
    throw cause
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

  delete: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      await deleteDraftPublicTopThree(id, ludo.id, revisionInput(data))
      await audit({
        action: 'public_top_three.deleted',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
      })
      return { success: true }
    })
  },
}
