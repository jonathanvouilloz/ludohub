import { fail } from '@sveltejs/kit'
import {
  approveAbsence,
  cancelOwnAbsence,
  AbsenceServiceError,
  createAbsenceForMember,
  deleteAbsenceForLudo,
  listAbsencesForLudo,
  listAbsencesForMember,
  refuseAbsence,
  requestAbsence,
} from '$lib/server/services/absences.js'
import { getActiveMembersByLudo } from '$lib/server/db/members.js'
import { requireLudoContext, requireResponsableContext } from '$lib/server/ludo-context.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember } = await parent()
  const responsable = isResponsable(currentMember)

  if (responsable) {
    const [absences, members] = await Promise.all([
      listAbsencesForLudo(ludo.id),
      getActiveMembersByLudo(ludo.id),
    ])
    return { responsable, absences, members }
  }

  const absences = await listAbsencesForMember(currentMember.id)
  return { responsable, absences, members: [] }
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

  // Création directe par un·e responsable pour un membre (absence approuvée).
  createForMember: async (event) => {
    const { ludo, member } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      createAbsenceForMember({
        ludoId: ludo.id,
        memberId: String(data.get('memberId') ?? ''),
        responderId: member.id,
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

  // Suppression par un·e responsable de n'importe quelle absence de la ludo.
  deleteAbsence: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => deleteAbsenceForLudo(String(data.get('id') ?? ''), ludo.id))
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
