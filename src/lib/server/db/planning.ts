import { eq } from 'drizzle-orm'
import { db } from './index.js'
import { seasons, saturdaySlots, assignments } from '../schema.js'

export async function getSeasonsByLudo(ludoId: string) {
  return db.query.seasons.findMany({
    where: eq(seasons.ludoId, ludoId),
    orderBy: (s, { desc }) => desc(s.startDate),
  })
}

export async function getSlotsBySeason(seasonId: string) {
  return db.query.saturdaySlots.findMany({
    where: eq(saturdaySlots.seasonId, seasonId),
    with: { assignments: { with: { member: true } } },
    orderBy: (s, { asc }) => asc(s.date),
  })
}

export async function getAssignmentsBySlot(slotId: string) {
  return db.query.assignments.findMany({
    where: eq(assignments.slotId, slotId),
    with: { member: true },
  })
}
