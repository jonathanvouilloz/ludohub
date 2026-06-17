import { fail } from '@sveltejs/kit'
import { getActiveMembersByLudo } from '$lib/server/db/members.js'
import {
  assignMember,
  cancelSlot,
  getActiveSeason,
  getSeasonGrid,
  PlanningServiceError,
  removeMember,
  reopenSlot,
  requestSwap,
} from '$lib/server/services/planning.js'
import { requireLudoContext, requireResponsableContext } from '$lib/server/ludo-context.js'
import { isResponsable } from '$lib/utils/permissions.js'
import { toDateString } from '$lib/utils/dates.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  // `ludo`/`currentMember` viennent du `+layout.server.ts` parent : `await parent()`
  // garantit qu'ils sont posés (sinon course concurrente entre les `load` → 403).
  const { ludo, currentMember } = await parent()

  const responsable = isResponsable(currentMember)
  const activeSeason = await getActiveSeason(ludo.id)

  // Tout membre connecté voit la grille de la saison active + ses prochains samedis.
  // Seul·e un·e responsable peut assigner/annuler ; chacun·e peut échanger son samedi.
  const grid = activeSeason ? await getSeasonGrid(activeSeason.id, ludo.id) : null
  // Membres actifs : filtre « Tous les membres » + dialog d'assignation responsable.
  const members = await getActiveMembersByLudo(ludo.id)

  return {
    responsable,
    currentMemberId: currentMember.id,
    today: toDateString(new Date()),
    activeSeason: activeSeason ?? null,
    slots: grid?.slots ?? [],
    members,
  }
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
  // Échange initié par un membre : il échange SON samedi (slotA) contre un autre.
  swap: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      requestSwap(
        member.id,
        String(data.get('slotAId') ?? ''),
        String(data.get('memberAId') ?? ''),
        String(data.get('slotBId') ?? ''),
        String(data.get('memberBId') ?? ''),
        ludo.id,
      ),
    )
  },

  // ─── Contrôles responsable inline ─────────────────────────────────────────
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
}
