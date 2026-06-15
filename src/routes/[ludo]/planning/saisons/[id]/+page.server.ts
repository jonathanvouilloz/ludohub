import { error, fail } from '@sveltejs/kit'
import { getActiveMembersByLudo } from '$lib/server/db/members.js'
import {
  assignMember,
  cancelSlot,
  getSeasonGrid,
  PlanningServiceError,
  removeMember,
  reopenSlot,
  swapMembers,
} from '$lib/server/services/planning.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.ludo || !locals.currentMember) throw error(403, 'Accès refusé')
  const responsable = isResponsable(locals.currentMember)
  const { season, slots } = await getSeasonGrid(params.id, locals.ludo.id)
  // Liste des membres seulement utile aux responsables (dialog d'assignation).
  const members = responsable ? await getActiveMembersByLudo(locals.ludo.id) : []
  return { season, slots, members, responsable }
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
  assign: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    return run(() =>
      assignMember(String(data.get('slotId') ?? ''), String(data.get('memberId') ?? ''), ludo.id),
    )
  },

  remove: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    return run(() =>
      removeMember(String(data.get('slotId') ?? ''), String(data.get('memberId') ?? ''), ludo.id),
    )
  },

  cancelSlot: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    return run(() => cancelSlot(String(data.get('slotId') ?? ''), ludo.id))
  },

  reopenSlot: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    return run(() => reopenSlot(String(data.get('slotId') ?? ''), ludo.id))
  },

  swap: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    return run(() =>
      swapMembers(
        String(data.get('slotAId') ?? ''),
        String(data.get('memberAId') ?? ''),
        String(data.get('slotBId') ?? ''),
        String(data.get('memberBId') ?? ''),
        ludo.id,
      ),
    )
  },
}
