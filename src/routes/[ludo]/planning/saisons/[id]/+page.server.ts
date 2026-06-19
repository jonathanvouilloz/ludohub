import { fail } from '@sveltejs/kit'
import { getActiveMembersByLudo } from '$lib/server/db/members.js'
import { getApprovedAbsencesInRange } from '$lib/server/db/absences.js'
import { clearAssignmentsBySeason, getMemberSettingsBySeason } from '$lib/server/db/planning.js'
import {
  addMemberUnavailability,
  assignMember,
  cancelSlot,
  createClosurePeriod,
  deleteClosurePeriod,
  generatePlanning,
  getSeasonGrid,
  importGEVacations,
  PlanningServiceError,
  removeMember,
  reopenSlot,
  saveMemberConfig,
  setMember,
  swapMembers,
} from '$lib/server/services/planning.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import { isResponsable } from '$lib/utils/permissions.js'
import { isGenevaHoliday, isDateInRange, toDateString } from '$lib/utils/dates.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
  const { ludo, currentMember } = await parent()
  const responsable = isResponsable(currentMember)
  const { season, slots, closures } = await getSeasonGrid(params.id, ludo.id)
  const members = responsable ? await getActiveMembersByLudo(ludo.id) : []

  // Données de configuration pour le panneau d'auto-génération (responsable uniquement)
  const memberSettings = responsable ? await getMemberSettingsBySeason(params.id) : []
  const seasonAbsences = responsable
    ? await getApprovedAbsencesInRange(ludo.id, season.startDate, season.endDate)
    : []

  // Preview pour le dialog de génération
  const settingsMap = new Map(memberSettings.map((s) => [s.memberId, s.isPermanent]))
  const permanentCount = members.filter((m) => settingsMap.get(m.id) === true).length
  const workableSlotsCount = slots.filter(
    (s) =>
      !s.isCancelled &&
      !isGenevaHoliday(s.date) &&
      !closures.some((c) => isDateInRange(s.date, c.startDate, c.endDate)),
  ).length
  const existingAssignmentsCount = slots.reduce((sum, s) => sum + s.assignments.length, 0)

  return {
    season,
    slots,
    closures,
    members,
    responsable,
    memberSettings,
    seasonAbsences,
    permanentCount,
    poolCount: members.length - permanentCount,
    workableSlotsCount,
    existingAssignmentsCount,
    today: toDateString(new Date()),
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

  setMember: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      setMember(
        String(data.get('slotId') ?? ''),
        String(data.get('memberId') ?? ''),
        String(data.get('newMemberId') ?? ''),
        ludo.id,
      ),
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

  importFromGE: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const seasonId = String(event.params.id ?? '')
    try {
      const imported = await importGEVacations(seasonId, ludo.id)
      return { success: true, imported }
    } catch (err) {
      if (err instanceof PlanningServiceError) return fail(400, { error: err.message })
      throw err
    }
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

  saveMemberConfig: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      saveMemberConfig(
        String(event.params.id ?? ''),
        ludo.id,
        String(data.get('memberId') ?? ''),
        data.get('isPermanent') === 'true',
      ),
    )
  },

  addUnavailability: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      addMemberUnavailability(
        String(event.params.id ?? ''),
        ludo.id,
        String(data.get('memberId') ?? ''),
        String(data.get('startDate') ?? ''),
        String(data.get('endDate') ?? ''),
      ),
    )
  },

  generatePlanning: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const seasonId = String(event.params.id ?? '')
    const requiredCount = Number(data.get('requiredCount') ?? 3)
    return run(async () => {
      await clearAssignmentsBySeason(seasonId)
      await generatePlanning(seasonId, ludo.id, requiredCount)
    })
  },
}
