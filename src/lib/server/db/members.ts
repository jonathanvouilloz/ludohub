import { and, count, eq, or } from 'drizzle-orm'
import { db } from './index.js'
import { absences, assignments, members, type MemberInsert, type MemberRow } from '../schema.js'

export async function getMembersByLudo(ludoId: string): Promise<MemberRow[]> {
  return db.query.members.findMany({
    where: eq(members.ludoId, ludoId),
    orderBy: (m, { asc }) => asc(m.name),
  })
}

export async function getActiveMembersByLudo(ludoId: string): Promise<MemberRow[]> {
  return db.query.members.findMany({
    where: and(eq(members.ludoId, ludoId), eq(members.isActive, true)),
    orderBy: (m, { asc }) => asc(m.name),
  })
}

export async function getMemberById(id: string): Promise<MemberRow | undefined> {
  return db.query.members.findFirst({ where: eq(members.id, id) })
}

export async function createMember(data: MemberInsert): Promise<MemberRow> {
  const [member] = await db.insert(members).values(data).returning()
  return member
}

export async function updateMember(id: string, data: Partial<MemberInsert>): Promise<MemberRow> {
  const [member] = await db.update(members).set(data).where(eq(members.id, id)).returning()
  return member
}

export async function softDeleteMember(id: string): Promise<MemberRow> {
  return updateMember(id, { isActive: false })
}

export async function hardDeleteMember(id: string): Promise<void> {
  await db.delete(members).where(eq(members.id, id))
}

/** Nombre de responsables actifs dans une ludo (garde-fou « au moins un responsable »). */
export async function countResponsablesActifs(ludoId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(members)
    .where(
      and(eq(members.ludoId, ludoId), eq(members.role, 'responsable'), eq(members.isActive, true)),
    )
  return row?.value ?? 0
}

/** true si le membre est référencé par une assignation ou une absence (suppression bloquée). */
export async function memberHasDependencies(id: string): Promise<boolean> {
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.memberId, id),
    columns: { id: true },
  })
  if (assignment) return true

  const absence = await db.query.absences.findFirst({
    where: or(eq(absences.memberId, id), eq(absences.respondedBy, id)),
    columns: { id: true },
  })
  return Boolean(absence)
}
