import { fail } from '@sveltejs/kit'
import {
  createSupplyRequest,
  deleteSupplyRequest,
  listSupplyRequests,
  SupplyServiceError,
  updateSupplyStatus,
} from '$lib/server/services/supplies.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember } = await parent()
  const supplies = await listSupplyRequests(ludo.id)
  return { supplies, responsable: isResponsable(currentMember), currentMemberId: currentMember.id }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof SupplyServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  // Tout membre actif peut créer une demande.
  create: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      createSupplyRequest(ludo.id, member.id, {
        name: String(data.get('name') ?? ''),
        category: String(data.get('category') ?? ''),
        urgency: String(data.get('urgency') ?? ''),
        notes: String(data.get('notes') ?? ''),
      }),
    )
  },

  // Changement de statut : tout membre actif.
  updateStatus: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      updateSupplyStatus(String(data.get('id') ?? ''), ludo.id, String(data.get('status') ?? '')),
    )
  },

  // Suppression : auteur·e ou responsable (vérifié dans le service).
  delete: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => deleteSupplyRequest(String(data.get('id') ?? ''), ludo.id, member))
  },
}
