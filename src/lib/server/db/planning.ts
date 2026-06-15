import { and, eq, gte } from 'drizzle-orm'
import { db } from './index.js'
import {
  assignments,
  saturdaySlots,
  seasons,
  type AssignmentInsert,
  type AssignmentRow,
  type SaturdaySlotInsert,
  type SaturdaySlotRow,
  type SeasonInsert,
  type SeasonRow,
} from '../schema.js'

// ─── Saisons ───────────────────────────────────────────────────────────────

export async function getSeasonsByLudo(ludoId: string): Promise<SeasonRow[]> {
  return db.query.seasons.findMany({
    where: eq(seasons.ludoId, ludoId),
    orderBy: (s, { desc }) => desc(s.startDate),
  })
}

export async function getSeasonById(id: string): Promise<SeasonRow | undefined> {
  return db.query.seasons.findFirst({ where: eq(seasons.id, id) })
}

/** Saison active par défaut : la plus récente non archivée de la ludo. */
export async function getActiveSeasonByLudo(ludoId: string): Promise<SeasonRow | undefined> {
  return db.query.seasons.findFirst({
    where: and(eq(seasons.ludoId, ludoId), eq(seasons.isArchived, false)),
    orderBy: (s, { desc }) => desc(s.startDate),
  })
}

export async function insertSeason(data: SeasonInsert): Promise<SeasonRow> {
  const [season] = await db.insert(seasons).values(data).returning()
  return season
}

export async function archiveSeason(id: string, archived: boolean): Promise<SeasonRow> {
  const [season] = await db
    .update(seasons)
    .set({ isArchived: archived })
    .where(eq(seasons.id, id))
    .returning()
  return season
}

export async function deleteSeason(id: string): Promise<void> {
  await db.delete(seasons).where(eq(seasons.id, id))
}

// ─── Samedis (slots) ─────────────────────────────────────────────────────────

/** Slots d'une saison, avec leurs assignations et le membre assigné, triés par date. */
export async function getSlotsBySeason(seasonId: string) {
  return db.query.saturdaySlots.findMany({
    where: eq(saturdaySlots.seasonId, seasonId),
    with: { assignments: { with: { member: true } } },
    orderBy: (s, { asc }) => asc(s.date),
  })
}

export async function getSlotById(id: string): Promise<SaturdaySlotRow | undefined> {
  return db.query.saturdaySlots.findFirst({ where: eq(saturdaySlots.id, id) })
}

export async function insertSlots(data: SaturdaySlotInsert[]): Promise<void> {
  if (data.length === 0) return
  await db.insert(saturdaySlots).values(data)
}

export async function setSlotCancelled(
  slotId: string,
  cancelled: boolean,
): Promise<SaturdaySlotRow> {
  const [slot] = await db
    .update(saturdaySlots)
    .set({ isCancelled: cancelled })
    .where(eq(saturdaySlots.id, slotId))
    .returning()
  return slot
}

// ─── Assignations ────────────────────────────────────────────────────────────

export async function getAssignmentsBySlot(slotId: string) {
  return db.query.assignments.findMany({
    where: eq(assignments.slotId, slotId),
    with: { member: true },
  })
}

export async function getAssignment(
  slotId: string,
  memberId: string,
): Promise<AssignmentRow | undefined> {
  return db.query.assignments.findFirst({
    where: and(eq(assignments.slotId, slotId), eq(assignments.memberId, memberId)),
  })
}

export async function insertAssignment(data: AssignmentInsert): Promise<AssignmentRow> {
  const [assignment] = await db.insert(assignments).values(data).returning()
  return assignment
}

export async function deleteAssignment(slotId: string, memberId: string): Promise<void> {
  await db
    .delete(assignments)
    .where(and(eq(assignments.slotId, slotId), eq(assignments.memberId, memberId)))
}

/** Échange atomique : memberA passe du slotA au memberB et inversement (db.batch, neon-http). */
export async function swapAssignments(
  slotAId: string,
  memberAId: string,
  slotBId: string,
  memberBId: string,
): Promise<void> {
  await db.batch([
    db
      .update(assignments)
      .set({ memberId: memberBId })
      .where(and(eq(assignments.slotId, slotAId), eq(assignments.memberId, memberAId))),
    db
      .update(assignments)
      .set({ memberId: memberAId })
      .where(and(eq(assignments.slotId, slotBId), eq(assignments.memberId, memberBId))),
  ])
}

/** Prochains samedis d'un membre (date >= fromDate, non annulés), triés par date. */
export async function getUpcomingAssignmentsForMember(memberId: string, fromDate: string) {
  return db
    .select({
      slotId: saturdaySlots.id,
      date: saturdaySlots.date,
      seasonName: seasons.name,
    })
    .from(assignments)
    .innerJoin(saturdaySlots, eq(assignments.slotId, saturdaySlots.id))
    .innerJoin(seasons, eq(saturdaySlots.seasonId, seasons.id))
    .where(
      and(
        eq(assignments.memberId, memberId),
        eq(saturdaySlots.isCancelled, false),
        gte(saturdaySlots.date, fromDate),
      ),
    )
    .orderBy(saturdaySlots.date)
}
