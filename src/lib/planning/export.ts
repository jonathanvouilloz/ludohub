import { formatDayWeekday, formatMonthYear } from '$lib/utils/dates.js'
import type {
  AbsenceRow,
  AssignmentRow,
  ClosurePeriodRow,
  MemberRow,
  SaturdaySlotRow,
} from '$lib/server/schema.js'

export type PlanningAssignment = AssignmentRow & {
  member: MemberRow
  absence: AbsenceRow | null
}

export type PlanningSlot = SaturdaySlotRow & {
  closure: ClosurePeriodRow | null
  assignments: PlanningAssignment[]
}

export type PlanningMonth = {
  key: string
  label: string
  slots: PlanningSlot[]
}

export type PlanningExportRow = {
  date: string
  dateLabel: string
  status: string
  team: string
  filledCount: number
  requiredCount: number
  isMine: boolean
  hasAbsence: boolean
}

/** Prépare une ligne de planning commune à l'impression et à l'export Excel. */
export function toPlanningExportRows(
  slots: PlanningSlot[],
  currentMemberId: string,
): PlanningExportRow[] {
  return slots.map((slot) => {
    const filledCount = slot.assignments.filter((assignment) => !assignment.absence).length
    const isMine = slot.assignments.some((assignment) => assignment.member.id === currentMemberId)
    const hasAbsence = slot.assignments.some((assignment) => !!assignment.absence)

    let status = 'Ouvert'
    if (slot.closure) status = `Fermé — ${slot.closure.label}`
    else if (slot.isCancelled) status = 'Fermé'

    return {
      date: slot.date,
      dateLabel: formatDayWeekday(slot.date),
      status,
      team: slot.assignments.map((assignment) => assignment.member.name).join(', ') || '—',
      filledCount,
      requiredCount: slot.requiredCount,
      isMine,
      hasAbsence,
    }
  })
}

export function groupPlanningSlotsByMonth(slots: PlanningSlot[]): PlanningMonth[] {
  const months: PlanningMonth[] = []

  for (const slot of slots) {
    const key = slot.date.slice(0, 7)
    const previous = months.at(-1)
    if (previous?.key === key) previous.slots.push(slot)
    else months.push({ key, label: formatMonthYear(slot.date), slots: [slot] })
  }

  return months
}
