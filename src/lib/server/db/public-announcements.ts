import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicAnnouncements,
  publicAnnouncementSites,
  type PublicAnnouncementInsert,
  type PublicAnnouncementRow,
  type PublicContentStatus,
} from '../schema.js'

const announcementWithRelations = {
  author: true,
  updatedBy: true,
  publishedBy: true,
  targets: { with: { site: true } },
} as const

const announcementOrder = [desc(publicAnnouncements.createdAt), asc(publicAnnouncements.id)]

export type PublicAnnouncementUpdateData = Pick<
  PublicAnnouncementInsert,
  'title' | 'message' | 'updatedByMemberId'
>

export function listPublicAnnouncementRows(ludoId: string) {
  return db.query.publicAnnouncements.findMany({
    where: eq(publicAnnouncements.ludoId, ludoId),
    with: announcementWithRelations,
    orderBy: announcementOrder,
  })
}

export function listPublishedPublicAnnouncementRows(ludoId: string) {
  return db.query.publicAnnouncements.findMany({
    where: and(eq(publicAnnouncements.ludoId, ludoId), eq(publicAnnouncements.status, 'published')),
    with: announcementWithRelations,
    orderBy: announcementOrder,
  })
}

export function getPublicAnnouncementRowForLudo(announcementId: string, ludoId: string) {
  return db.query.publicAnnouncements.findFirst({
    where: and(eq(publicAnnouncements.id, announcementId), eq(publicAnnouncements.ludoId, ludoId)),
    with: announcementWithRelations,
  })
}

export async function insertPublicAnnouncementAtomic(
  data: PublicAnnouncementInsert & { id: string },
  siteIds: string[],
) {
  const insertAnnouncement = db.insert(publicAnnouncements).values(data)
  if (siteIds.length === 0) {
    await insertAnnouncement
  } else {
    await db.batch([
      insertAnnouncement,
      db.insert(publicAnnouncementSites).values(
        siteIds.map((siteId) => ({
          announcementId: data.id,
          ludoId: data.ludoId,
          siteId,
        })),
      ),
    ])
  }
  return getPublicAnnouncementRowForLudo(data.id, data.ludoId)
}

export async function updatePublicAnnouncementAtomic(
  announcementId: string,
  ludoId: string,
  expectedRevision: number,
  data: PublicAnnouncementUpdateData & { updatedAt: Date },
  siteIds: string[],
) {
  const desiredTargets =
    siteIds.length === 0
      ? sql`SELECT null::uuid AS site_id WHERE false`
      : sql`VALUES ${sql.join(
          siteIds.map((siteId) => sql`(${siteId}::uuid)`),
          sql`, `,
        )}`

  const result = await db.execute<{ id: string }>(sql`
    WITH desired(site_id) AS (${desiredTargets}), updated AS (
      UPDATE public_announcements
      SET title = ${data.title},
          message = ${data.message},
          updated_by_member_id = ${data.updatedByMemberId}::uuid,
          updated_at = ${data.updatedAt},
          revision = revision + 1
      WHERE id = ${announcementId}::uuid
        AND ludo_id = ${ludoId}::uuid
        AND revision = ${expectedRevision}
      RETURNING id, ludo_id
    ), deleted AS (
      DELETE FROM public_announcement_sites AS existing
      USING updated
      WHERE existing.announcement_id = updated.id
        AND existing.ludo_id = updated.ludo_id
        AND NOT EXISTS (
          SELECT 1 FROM desired WHERE desired.site_id = existing.site_id
        )
      RETURNING existing.announcement_id
    ), inserted AS (
      INSERT INTO public_announcement_sites (announcement_id, ludo_id, site_id)
      SELECT updated.id, updated.ludo_id, desired.site_id
      FROM updated
      CROSS JOIN desired
      ON CONFLICT (announcement_id, site_id) DO NOTHING
      RETURNING announcement_id
    )
    SELECT id FROM updated
  `)
  if (result.rows.length === 0) return undefined
  return getPublicAnnouncementRowForLudo(announcementId, ludoId)
}

export async function updatePublicAnnouncementPublicationRow(
  announcementId: string,
  ludoId: string,
  expectedStatus: PublicContentStatus,
  expectedRevision: number,
  data: Pick<
    PublicAnnouncementInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
): Promise<PublicAnnouncementRow | undefined> {
  const [row] = await db
    .update(publicAnnouncements)
    .set({ ...data, revision: sql`${publicAnnouncements.revision} + 1` })
    .where(
      and(
        eq(publicAnnouncements.id, announcementId),
        eq(publicAnnouncements.ludoId, ludoId),
        eq(publicAnnouncements.status, expectedStatus),
        eq(publicAnnouncements.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function deletePublicAnnouncementRow(announcementId: string, ludoId: string) {
  const [row] = await db
    .delete(publicAnnouncements)
    .where(and(eq(publicAnnouncements.id, announcementId), eq(publicAnnouncements.ludoId, ludoId)))
    .returning({ id: publicAnnouncements.id })
  return row
}
