import { and, eq } from 'drizzle-orm'
import { db } from './index.js'
import { absences, type AbsenceInsert } from '../schema.js'

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

export async function createAbsence(data: AbsenceInsert) {
  const [absence] = await db.insert(absences).values(data).returning()
  return absence
}
