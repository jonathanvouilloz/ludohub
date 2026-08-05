import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicDirectoryEntries as entries,
  type PublicContentStatus,
  type PublicDirectoryEntryInsert,
} from '../schema.js'
const rel = { author: true, updatedBy: true, publishedBy: true } as const
export const listPublicDirectoryRows = (l: string) =>
  db.query.publicDirectoryEntries.findMany({
    where: eq(entries.ludoId, l),
    with: rel,
    orderBy: [asc(entries.sortOrder), asc(entries.id)],
  })
export const getPublicDirectoryRowForLudo = (id: string, l: string) =>
  db.query.publicDirectoryEntries.findFirst({
    where: and(eq(entries.id, id), eq(entries.ludoId, l)),
    with: rel,
  })
export const listPublishedPublicDirectoryRows = (l: string, limit: number) =>
  db
    .select({
      id: entries.id,
      slug: entries.slug,
      name: entries.name,
      descriptionMarkdown: entries.descriptionMarkdown,
      address: entries.address,
      postalCode: entries.postalCode,
      city: entries.city,
      phone: entries.phone,
      email: entries.email,
      website: entries.website,
      directionsUrl: entries.directionsUrl,
      officialUrl: entries.officialUrl,
      sortOrder: entries.sortOrder,
    })
    .from(entries)
    .where(and(eq(entries.ludoId, l), eq(entries.status, 'published')))
    .orderBy(asc(entries.sortOrder), asc(entries.id))
    .limit(limit)
export async function insertPublicDirectoryRow(data: PublicDirectoryEntryInsert & { id: string }) {
  const [row] = await db.insert(entries).values(data).returning()
  return row
}
export async function updatePublicDirectoryRow(
  id: string,
  l: string,
  r: number,
  data: Partial<PublicDirectoryEntryInsert>,
) {
  const [row] = await db
    .update(entries)
    .set({ ...data, revision: sql`${entries.revision}+1` })
    .where(and(eq(entries.id, id), eq(entries.ludoId, l), eq(entries.revision, r)))
    .returning()
  return row
}
export async function updatePublicDirectoryPublicationRow(
  id: string,
  l: string,
  status: PublicContentStatus,
  r: number,
  data: Pick<
    PublicDirectoryEntryInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(entries)
    .set({ ...data, revision: sql`${entries.revision}+1` })
    .where(
      and(
        eq(entries.id, id),
        eq(entries.ludoId, l),
        eq(entries.status, status),
        eq(entries.revision, r),
      ),
    )
    .returning()
  return row
}
export async function deleteDraftPublicDirectoryRow(id: string, l: string, r: number) {
  const [row] = await db
    .delete(entries)
    .where(
      and(
        eq(entries.id, id),
        eq(entries.ludoId, l),
        eq(entries.status, 'draft'),
        eq(entries.revision, r),
      ),
    )
    .returning({ id: entries.id })
  return row
}
