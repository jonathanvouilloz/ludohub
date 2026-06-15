import { db } from '../db/index.js'
import { seasons, saturdaySlots, assignments } from '../schema.js'
import { getSwissSaturdays, toDateString } from '$lib/utils/dates.js'
import { and, eq } from 'drizzle-orm'

/**
 * Crée une saison et génère automatiquement tous ses samedis.
 */
export async function createSeasonWithSlots(
  ludoId: string,
  name: string,
  startDate: Date,
  endDate: Date,
  requiredCount = 2,
) {
  const [season] = await db
    .insert(seasons)
    .values({ ludoId, name, startDate: toDateString(startDate), endDate: toDateString(endDate) })
    .returning()

  const saturdays = getSwissSaturdays(startDate, endDate)
  if (saturdays.length > 0) {
    await db.insert(saturdaySlots).values(
      saturdays.map((date) => ({
        seasonId: season.id,
        date: toDateString(date),
        requiredCount,
      })),
    )
  }

  return season
}

/**
 * Assigne un membre à un slot. Lève une erreur si déjà assigné.
 */
export async function assignMember(slotId: string, memberId: string) {
  const existing = await db.query.assignments.findFirst({
    where: and(eq(assignments.slotId, slotId), eq(assignments.memberId, memberId)),
  })
  if (existing) throw new Error('Membre déjà assigné à ce samedi')

  const [assignment] = await db.insert(assignments).values({ slotId, memberId }).returning()
  return assignment
}

/**
 * Swap deux membres sur leurs slots respectifs.
 */
export async function swapMembers(
  slotAId: string,
  memberAId: string,
  slotBId: string,
  memberBId: string,
) {
  await db
    .update(assignments)
    .set({ memberId: memberBId })
    .where(and(eq(assignments.slotId, slotAId), eq(assignments.memberId, memberAId)))

  await db
    .update(assignments)
    .set({ memberId: memberAId })
    .where(and(eq(assignments.slotId, slotBId), eq(assignments.memberId, memberBId)))
}
