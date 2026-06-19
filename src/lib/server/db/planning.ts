import { and, eq, gte, inArray } from 'drizzle-orm'
import { db } from './index.js'
import {
  assignments,
  closurePeriods,
  saturdaySlots,
  seasonMemberSettings,
  seasons,
  type AssignmentInsert,
  type AssignmentRow,
  type ClosurePeriodInsert,
  type ClosurePeriodRow,
  type SaturdaySlotInsert,
  type SaturdaySlotRow,
  type SeasonInsert,
  type SeasonMemberSettingInsert,
  type SeasonMemberSettingRow,
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

/** Saison active explicite : la saison avec `isActive = true` pour cette ludo. */
export async function getActiveSeasonByLudo(ludoId: string): Promise<SeasonRow | undefined> {
  return db.query.seasons.findFirst({
    where: and(eq(seasons.ludoId, ludoId), eq(seasons.isActive, true)),
  })
}

/**
 * Active une saison et archive atomiquement la précédente active (si elle existe).
 * Utilise `db.batch()` pour l'atomicité (neon-http sans transaction interactive).
 */
export async function activateSeasonInDb(
  seasonId: string,
  previousActiveId: string | null,
): Promise<void> {
  if (previousActiveId) {
    await db.batch([
      db
        .update(seasons)
        .set({ isActive: false, isArchived: true })
        .where(eq(seasons.id, previousActiveId)),
      db.update(seasons).set({ isActive: true }).where(eq(seasons.id, seasonId)),
    ])
  } else {
    await db.update(seasons).set({ isActive: true }).where(eq(seasons.id, seasonId))
  }
}

export async function insertSeason(data: SeasonInsert): Promise<SeasonRow> {
  const [season] = await db.insert(seasons).values(data).returning()
  return season
}

export async function archiveSeason(
  id: string,
  archived: boolean,
  deactivate = false,
): Promise<SeasonRow> {
  const [season] = await db
    .update(seasons)
    .set({ isArchived: archived, ...(deactivate ? { isActive: false } : {}) })
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

/** Remplace atomiquement un membre par un autre sur un slot (db.batch, neon-http). */
export async function replaceAssignment(
  slotId: string,
  oldMemberId: string,
  newMemberId: string,
): Promise<void> {
  await db.batch([
    db
      .delete(assignments)
      .where(and(eq(assignments.slotId, slotId), eq(assignments.memberId, oldMemberId))),
    db.insert(assignments).values({ slotId, memberId: newMemberId }),
  ])
}

// ─── Plages de fermeture / vacances ──────────────────────────────────────────

export async function getClosurePeriodsBySeason(seasonId: string): Promise<ClosurePeriodRow[]> {
  return db.query.closurePeriods.findMany({
    where: eq(closurePeriods.seasonId, seasonId),
    orderBy: (c, { asc }) => asc(c.startDate),
  })
}

export async function insertClosurePeriod(data: ClosurePeriodInsert): Promise<ClosurePeriodRow> {
  const [period] = await db.insert(closurePeriods).values(data).returning()
  return period
}

export async function getClosurePeriodById(id: string): Promise<ClosurePeriodRow | undefined> {
  return db.query.closurePeriods.findFirst({ where: eq(closurePeriods.id, id) })
}

export async function deleteClosurePeriod(id: string): Promise<void> {
  await db.delete(closurePeriods).where(eq(closurePeriods.id, id))
}

// ─── Configuration membres par saison ────────────────────────────────────────

export async function getMemberSettingsBySeason(
  seasonId: string,
): Promise<SeasonMemberSettingRow[]> {
  return db.query.seasonMemberSettings.findMany({
    where: eq(seasonMemberSettings.seasonId, seasonId),
  })
}

export async function upsertMemberSetting(
  data: SeasonMemberSettingInsert,
): Promise<SeasonMemberSettingRow> {
  const [setting] = await db
    .insert(seasonMemberSettings)
    .values(data)
    .onConflictDoUpdate({
      target: [seasonMemberSettings.seasonId, seasonMemberSettings.memberId],
      set: { isPermanent: data.isPermanent },
    })
    .returning()
  return setting
}

export async function updateSlotsRequiredCount(
  seasonId: string,
  requiredCount: number,
): Promise<void> {
  await db.update(saturdaySlots).set({ requiredCount }).where(eq(saturdaySlots.seasonId, seasonId))
}

export async function clearAssignmentsBySeason(seasonId: string): Promise<void> {
  const slotIds = (
    await db
      .select({ id: saturdaySlots.id })
      .from(saturdaySlots)
      .where(eq(saturdaySlots.seasonId, seasonId))
  ).map((s) => s.id)

  if (slotIds.length === 0) return
  await db.delete(assignments).where(inArray(assignments.slotId, slotIds))
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
