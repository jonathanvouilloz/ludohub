import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from './index.js'
import { absences, type AbsenceInsert, type AbsenceRow } from '../schema.js'

export async function getAbsencesByLudo(ludoId: string) {
  return db.query.absences.findMany({
    where: eq(absences.ludoId, ludoId),
    with: { member: true },
    orderBy: (a, { desc }) => desc(a.createdAt),
  })
}

export async function getPendingAbsencesByLudo(ludoId: string) {
  return db.query.absences.findMany({
    where: and(eq(absences.ludoId, ludoId), eq(absences.status, 'en_attente')),
    with: { member: true },
    orderBy: (a, { asc }) => asc(a.startDate),
  })
}

export async function getAbsencesByMember(memberId: string) {
  return db.query.absences.findMany({
    where: eq(absences.memberId, memberId),
    orderBy: (a, { desc }) => desc(a.createdAt),
  })
}

export async function getAbsenceById(id: string): Promise<AbsenceRow | undefined> {
  return db.query.absences.findFirst({ where: eq(absences.id, id) })
}

export async function insertAbsence(data: AbsenceInsert): Promise<AbsenceRow> {
  const [absence] = await db.insert(absences).values(data).returning()
  return absence
}

export async function updateAbsenceStatus(
  id: string,
  data: { status: AbsenceRow['status']; responderNotes: string | null; respondedBy: string },
): Promise<AbsenceRow> {
  const [updated] = await db
    .update(absences)
    .set({
      status: data.status,
      responderNotes: data.responderNotes,
      respondedBy: data.respondedBy,
    })
    .where(eq(absences.id, id))
    .returning()
  return updated
}

export async function deleteAbsence(id: string): Promise<void> {
  await db.delete(absences).where(eq(absences.id, id))
}

/**
 * Absences approuvées d'une ludo dont la plage chevauche [startDate, endDate].
 * Chevauchement : début ≤ fin de plage ET fin ≥ début de plage.
 * Sert à croiser le planning avec les absences pour générer les warnings.
 */
export async function getApprovedAbsencesInRange(
  ludoId: string,
  startDate: string,
  endDate: string,
): Promise<AbsenceRow[]> {
  return db.query.absences.findMany({
    where: and(
      eq(absences.ludoId, ludoId),
      eq(absences.status, 'approuve'),
      lte(absences.startDate, endDate),
      gte(absences.endDate, startDate),
    ),
  })
}
