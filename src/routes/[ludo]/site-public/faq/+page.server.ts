import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import {
  createPublicFaq,
  deleteDraftPublicFaq,
  hidePublicFaq,
  listPublicFaqsForManagement,
  publishPublicFaq,
  PublicFaqServiceError,
  type PublicFaqInput,
  type PublicFaqTargeting,
  updatePublicFaq,
} from '$lib/server/services/public-faqs.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import type { Actions, PageServerLoad } from './$types'

async function context(event: RequestEvent) {
  const value = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(value.ludo.id))) throw error(404, 'Module indisponible')
  return value
}
function targets(data: FormData): PublicFaqTargeting {
  const targetMode = data.get('targetMode')
  const siteIds = data.getAll('siteIds').map(String)
  if (targetMode === 'all') {
    if (siteIds.length)
      throw new PublicFaqServiceError('Le ciblage global ne prend pas de lieu précis.')
    return { targetMode, siteIds: [] }
  }
  if (targetMode === 'explicit') {
    if (!siteIds.length) throw new PublicFaqServiceError('Sélectionnez au moins un lieu actif.')
    return { targetMode, siteIds }
  }
  throw new PublicFaqServiceError('Choisissez le mode de ciblage.')
}
function input(data: FormData): PublicFaqInput {
  return {
    question: String(data.get('question') ?? ''),
    answerMarkdown: String(data.get('answerMarkdown') ?? ''),
    category: String(data.get('category') ?? '').trim() || null,
    sortOrder: Number(data.get('sortOrder')),
    ...targets(data),
  }
}
function revision(data: FormData) {
  const value = Number(data.get('revision'))
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PublicFaqServiceError('Révision invalide.')
  return value
}
async function run(callback: () => Promise<unknown>) {
  try {
    return await callback()
  } catch (cause) {
    if (cause instanceof PublicFaqServiceError || cause instanceof PublicSiteServiceError)
      return fail(400, { error: cause.message })
    throw cause
  }
}
async function audit(
  action: string,
  ludoId: string,
  memberId: string,
  faqId: string,
  metadata?: Record<string, unknown>,
) {
  await emitAuditEvent({
    action,
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'public_faq',
    entityId: faqId,
    metadata,
  })
}

export const load: PageServerLoad = async (event) => {
  const { ludo } = await context(event)
  const [faqs, sites] = await Promise.all([
    listPublicFaqsForManagement(ludo.id),
    listSiteRowsWithOpeningHours(ludo.id),
  ])
  return { faqs, sites }
}
export const actions: Actions = {
  create: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    return run(async () => {
      const parsed = input(data)
      const faq = await createPublicFaq(ludo.id, member.id, parsed)
      await audit('public_faq.created', ludo.id, member.id, faq.id, {
        targetMode: parsed.targetMode,
        targetSiteIds: parsed.siteIds,
        sortOrder: parsed.sortOrder,
        hasCategory: parsed.category !== null,
      })
      return { success: true }
    })
  },
  update: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const parsed = input(data)
      const faq = await updatePublicFaq(id, ludo.id, parsed, member.id, revision(data))
      await audit('public_faq.updated', ludo.id, member.id, faq.id, {
        targetMode: parsed.targetMode,
        targetSiteIds: parsed.siteIds,
        sortOrder: parsed.sortOrder,
        hasCategory: parsed.category !== null,
      })
      return { success: true }
    })
  },
  publication: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const next = data.get('status')
      if (next !== 'published' && next !== 'hidden')
        throw new PublicFaqServiceError('Transition invalide.')
      const transition =
        next === 'published'
          ? await publishPublicFaq(id, ludo.id, member.id, revision(data))
          : await hidePublicFaq(id, ludo.id, member.id, revision(data))
      if (transition.changed)
        await audit(
          next === 'published' ? 'public_faq.published' : 'public_faq.hidden',
          ludo.id,
          member.id,
          transition.faq.id,
          { fromStatus: transition.previousStatus, toStatus: transition.faq.status },
        )
      return { success: true }
    })
  },
  delete: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      await deleteDraftPublicFaq(id, ludo.id, revision(data))
      await audit('public_faq.deleted', ludo.id, member.id, id)
      return { success: true }
    })
  },
}
