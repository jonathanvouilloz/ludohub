import { fail } from '@sveltejs/kit'
import {
  activateSeason,
  archiveSeason,
  createSeason,
  deleteSeason,
  listSeasons,
  PlanningServiceError,
} from '$lib/server/services/planning.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember } = await parent()
  const seasons = await listSeasons(ludo.id)
  return { seasons, responsable: isResponsable(currentMember) }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof PlanningServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      createSeason(ludo.id, {
        name: String(data.get('name') ?? ''),
        startDate: String(data.get('startDate') ?? ''),
        endDate: String(data.get('endDate') ?? ''),
        activateNow: data.get('activateNow') === 'true',
      }),
    )
  },

  activate: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => activateSeason(String(data.get('id') ?? ''), ludo.id))
  },

  archive: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    const archived = String(data.get('archived') ?? 'true') === 'true'
    return run(() => archiveSeason(id, ludo.id, archived))
  },

  delete: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(() => deleteSeason(id, ludo.id))
  },
}
