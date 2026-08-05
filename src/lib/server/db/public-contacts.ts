import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicContactMessages as messages,
  type PublicContactMessageInsert,
  type PublicContactStatus,
} from '../schema.js'
export const listPublicContactRows = (
  l: string,
  status: PublicContactStatus | undefined,
  limit: number,
) =>
  db.query.publicContactMessages.findMany({
    where: and(eq(messages.ludoId, l), status ? eq(messages.status, status) : undefined),
    with: { handler: true },
    orderBy: [desc(messages.createdAt)],
    limit,
  })
export const getPublicContactRowForLudo = (id: string, l: string) =>
  db.query.publicContactMessages.findFirst({
    where: and(eq(messages.id, id), eq(messages.ludoId, l)),
    with: { handler: true },
  })
export const getPublicContactByIdempotency = (l: string, h: string) =>
  db.query.publicContactMessages.findFirst({
    where: and(eq(messages.ludoId, l), eq(messages.idempotencyKeyHash, h)),
  })
export async function insertPublicContactRow(data: PublicContactMessageInsert & { id: string }) {
  const [row] = await db.insert(messages).values(data).returning()
  return row
}
export async function transitionPublicContactRow(
  id: string,
  l: string,
  status: PublicContactStatus,
  r: number,
  data: Pick<
    PublicContactMessageInsert,
    'status' | 'handledByMemberId' | 'processedAt' | 'archivedAt' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(messages)
    .set({ ...data, revision: sql`${messages.revision}+1` })
    .where(
      and(
        eq(messages.id, id),
        eq(messages.ludoId, l),
        eq(messages.status, status),
        eq(messages.revision, r),
      ),
    )
    .returning()
  return row
}
