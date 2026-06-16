import { fail } from '@sveltejs/kit'
import { requireSessionContext } from '$lib/server/ludo-context.js'
import {
  cancelRequest,
  confirmVolunteer,
  getFeed,
  getPastForLudo,
  publishHelpRequest,
  respondToRequest,
  HelpServiceError,
} from '$lib/server/services/help.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember } = await parent()
  const [feed, past] = await Promise.all([
    getFeed(ludo.id, currentMember.id),
    getPastForLudo(ludo.id),
  ])
  return { feed, past }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof HelpServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo } = await requireSessionContext(event)
    const data = await event.request.formData()
    return run(() =>
      publishHelpRequest(ludo.id, {
        date: String(data.get('date') ?? ''),
        slotInfo: String(data.get('slotInfo') ?? ''),
        notes: String(data.get('notes') ?? ''),
      }),
    )
  },

  respond: async (event) => {
    const { ludo, member } = await requireSessionContext(event)
    const data = await event.request.formData()
    return run(() => respondToRequest(String(data.get('requestId') ?? ''), member.id, ludo.id))
  },

  confirm: async (event) => {
    const { ludo } = await requireSessionContext(event)
    const data = await event.request.formData()
    return run(() =>
      confirmVolunteer(
        String(data.get('requestId') ?? ''),
        String(data.get('responseId') ?? ''),
        ludo.id,
      ),
    )
  },

  cancel: async (event) => {
    const { ludo } = await requireSessionContext(event)
    const data = await event.request.formData()
    return run(() => cancelRequest(String(data.get('requestId') ?? ''), ludo.id))
  },
}
