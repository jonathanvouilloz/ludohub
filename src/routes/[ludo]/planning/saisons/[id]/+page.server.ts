import { fail } from '@sveltejs/kit'
import { getActiveMembersByLudo } from '$lib/server/db/members.js'
import {
  assignMember,
  cancelSlot,
  createClosurePeriod,
  deleteClosurePeriod,
  getSeasonGrid,
  PlanningServiceError,
  removeMember,
  reopenSlot,
  swapMembers,
} from '$lib/server/services/planning.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
  const { ludo, currentMember } = await parent()
  const responsable = isResponsable(currentMember)
  const { season, slots, closures } = await getSeasonGrid(params.id, ludo.id)
  // Liste des membres seulement utile aux responsables (dialog d'assignation).
  const members = responsable ? await getActiveMembersByLudo(ludo.id) : []
  return { season, slots, closures, members, responsable }
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
  assign: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      assignMember(String(data.get('slotId') ?? ''), String(data.get('memberId') ?? ''), ludo.id),
    )
  },

  remove: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      removeMember(String(data.get('slotId') ?? ''), String(data.get('memberId') ?? ''), ludo.id),
    )
  },

  cancelSlot: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => cancelSlot(String(data.get('slotId') ?? ''), ludo.id))
  },

  reopenSlot: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => reopenSlot(String(data.get('slotId') ?? ''), ludo.id))
  },

  swap: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
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

  createClosure: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      createClosurePeriod(String(event.params.id ?? ''), ludo.id, {
        label: String(data.get('label') ?? ''),
        startDate: String(data.get('startDate') ?? ''),
        endDate: String(data.get('endDate') ?? ''),
      }),
    )
  },

  deleteClosure: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => deleteClosurePeriod(String(data.get('closureId') ?? ''), ludo.id))
  },
}
