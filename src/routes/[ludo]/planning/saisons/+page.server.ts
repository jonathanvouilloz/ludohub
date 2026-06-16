import { error, fail } from '@sveltejs/kit'
import {
  archiveSeason,
  createSeason,
  deleteSeason,
  listSeasons,
  PlanningServiceError,
} from '$lib/server/services/planning.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember } = await parent()
  const seasons = await listSeasons(ludo.id)
  return { seasons, responsable: isResponsable(currentMember) }
}

function requireContext(locals: App.Locals) {
  if (!isResponsable(locals.currentMember) || !locals.ludo) {
    throw error(403, 'Accès refusé')
  }
  return { ludo: locals.ludo }
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
  create: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    return run(() =>
      createSeason(ludo.id, {
        name: String(data.get('name') ?? ''),
        startDate: String(data.get('startDate') ?? ''),
        endDate: String(data.get('endDate') ?? ''),
      }),
    )
  },

  archive: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    const id = String(data.get('id') ?? '')
    const archived = String(data.get('archived') ?? 'true') === 'true'
    return run(() => archiveSeason(id, ludo.id, archived))
  },

  delete: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    const id = String(data.get('id') ?? '')
    return run(() => deleteSeason(id, ludo.id))
  },
}
