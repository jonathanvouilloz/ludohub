import { and, eq } from 'drizzle-orm'
import { db } from './index.js'
import { members, type MemberInsert, type MemberRow } from '../schema.js'

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

export async function updateMember(
  id: string,
  data: Partial<MemberInsert>,
): Promise<MemberRow> {
  const [member] = await db.update(members).set(data).where(eq(members.id, id)).returning()
  return member
}
