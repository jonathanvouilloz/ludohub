import { and, count, eq, or } from 'drizzle-orm'
import { db } from './index.js'
import {
  absences,
  assignments,
  members,
  publicAnnouncements,
  publicActivities,
  publicNews,
  publicTopThrees,
  publicFaqs,
  publicDocuments,
  type MemberInsert,
  type MemberRow,
} from '../schema.js'

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

/** Responsables actifs d'une ludo — destinataires des notifs `action_required` internes. */
export async function getActiveResponsables(ludoId: string): Promise<MemberRow[]> {
  return db.query.members.findMany({
    where: and(
      eq(members.ludoId, ludoId),
      eq(members.role, 'responsable'),
      eq(members.isActive, true),
    ),
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

/** true si le membre est référencé par une donnée métier (suppression bloquée). */
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
  if (absence) return true

  const announcement = await db.query.publicAnnouncements.findFirst({
    where: or(
      eq(publicAnnouncements.authorMemberId, id),
      eq(publicAnnouncements.updatedByMemberId, id),
      eq(publicAnnouncements.publishedByMemberId, id),
    ),
    columns: { id: true },
  })
  if (announcement) return true

  const news = await db.query.publicNews.findFirst({
    where: or(
      eq(publicNews.authorMemberId, id),
      eq(publicNews.updatedByMemberId, id),
      eq(publicNews.publishedByMemberId, id),
    ),
    columns: { id: true },
  })
  if (news) return true

  const activity = await db.query.publicActivities.findFirst({
    where: or(
      eq(publicActivities.authorMemberId, id),
      eq(publicActivities.updatedByMemberId, id),
      eq(publicActivities.publishedByMemberId, id),
    ),
    columns: { id: true },
  })
  if (activity) return true

  const topThree = await db.query.publicTopThrees.findFirst({
    where: or(
      eq(publicTopThrees.authorMemberId, id),
      eq(publicTopThrees.updatedByMemberId, id),
      eq(publicTopThrees.publishedByMemberId, id),
    ),
    columns: { id: true },
  })
  if (topThree) return true

  const faq = await db.query.publicFaqs.findFirst({
    where: or(
      eq(publicFaqs.authorMemberId, id),
      eq(publicFaqs.updatedByMemberId, id),
      eq(publicFaqs.publishedByMemberId, id),
    ),
    columns: { id: true },
  })
  if (faq) return true

  const document = await db.query.publicDocuments.findFirst({
    where: or(
      eq(publicDocuments.authorMemberId, id),
      eq(publicDocuments.updatedByMemberId, id),
      eq(publicDocuments.publishedByMemberId, id),
    ),
    columns: { id: true },
  })
  return Boolean(document)
}
