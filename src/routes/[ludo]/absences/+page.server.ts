import { fail } from '@sveltejs/kit'
import {
  approveAbsence,
  cancelOwnAbsence,
  AbsenceServiceError,
  listAbsencesForLudo,
  listAbsencesForMember,
  refuseAbsence,
  requestAbsence,
} from '$lib/server/services/absences.js'
import { requireLudoContext, requireResponsableContext } from '$lib/server/ludo-context.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember } = await parent()
  const responsable = isResponsable(currentMember)

  if (responsable) {
    const absences = await listAbsencesForLudo(ludo.id)
    return { responsable, absences }
  }

  const absences = await listAbsencesForMember(currentMember.id)
  return { responsable, absences }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof AbsenceServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  // Tout membre connecté peut soumettre une demande.
  request: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      requestAbsence({
        ludoId: ludo.id,
        memberId: member.id,
        type: String(data.get('type') ?? ''),
        startDate: String(data.get('startDate') ?? ''),
        endDate: String(data.get('endDate') ?? ''),
        notes: String(data.get('notes') ?? ''),
      }),
    )
  },

  // Annulation par le membre propriétaire (vérifié dans le service).
  cancel: async (event) => {
    const { member } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => cancelOwnAbsence(String(data.get('id') ?? ''), member.id))
  },

  approve: async (event) => {
    const { ludo, member } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      approveAbsence(
        String(data.get('id') ?? ''),
        ludo.id,
        member.id,
        String(data.get('note') ?? ''),
      ),
    )
  },

  refuse: async (event) => {
    const { ludo, member } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      refuseAbsence(
        String(data.get('id') ?? ''),
        ludo.id,
        member.id,
        String(data.get('note') ?? ''),
      ),
    )
  },
}
