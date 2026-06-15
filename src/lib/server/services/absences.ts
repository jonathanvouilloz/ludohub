import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { absences, type AbsenceInsert } from '../schema.js'

export async function submitAbsence(data: AbsenceInsert) {
  const [absence] = await db.insert(absences).values(data).returning()
  return absence
}

export async function approveAbsence(absenceId: string, responderId: string, note?: string) {
  const [updated] = await db
    .update(absences)
    .set({ status: 'approuve', respondedBy: responderId, responderNotes: note ?? null })
    .where(eq(absences.id, absenceId))
    .returning()
  return updated
}

export async function refuseAbsence(absenceId: string, responderId: string, note?: string) {
  const [updated] = await db
    .update(absences)
    .set({ status: 'refuse', respondedBy: responderId, responderNotes: note ?? null })
    .where(eq(absences.id, absenceId))
    .returning()
  return updated
}
