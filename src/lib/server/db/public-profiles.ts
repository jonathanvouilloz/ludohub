import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicProfiles as profiles,
  type PublicContentStatus,
  type PublicProfileInsert,
  type PublicProfileSection,
} from '../schema.js'
const withRelations = {
  author: true,
  updatedBy: true,
  publishedBy: true,
} as const
export const listPublicProfileRows = (ludoId: string) =>
  db.query.publicProfiles.findMany({
    where: eq(profiles.ludoId, ludoId),
    with: withRelations,
    orderBy: [asc(profiles.section), asc(profiles.createdAt)],
  })
export const getPublicProfileRowForLudo = (id: string, ludoId: string) =>
  db.query.publicProfiles.findFirst({
    where: and(eq(profiles.id, id), eq(profiles.ludoId, ludoId)),
    with: withRelations,
  })
export function listVisiblePublicProfileRows(
  ludoId: string,
  section: PublicProfileSection | undefined,
  siteId: string | undefined,
  limit: number,
) {
  const requested = siteId ? sql`AND active.id=${siteId}::uuid` : sql``
  return db
    .select({
      id: profiles.id,
      ludoId: profiles.ludoId,
      section: profiles.section,
      displayName: profiles.displayName,
      roleTitle: profiles.roleTitle,
      bioText: profiles.bioText,
      photoUrl: profiles.photoUrl,
      photoAlt: profiles.photoAlt,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.ludoId, ludoId),
        eq(profiles.status, 'published'),
        section ? eq(profiles.section, section) : undefined,
        sql`EXISTS(SELECT 1 FROM ludo_sites active WHERE active.ludo_id=${profiles.ludoId} AND active.is_active=true ${requested})`,
      ),
    )
    .orderBy(asc(profiles.section), asc(profiles.createdAt))
    .limit(limit)
}
export async function insertPublicProfileAtomic(
  data: PublicProfileInsert & { id: string },
) {
  await db.insert(profiles).values(data)
  return getPublicProfileRowForLudo(data.id, data.ludoId)
}
export async function updatePublicProfileAtomic(
  id: string,
  ludoId: string,
  revision: number,
  data: Pick<
    PublicProfileInsert,
    | 'section'
    | 'displayName'
    | 'roleTitle'
    | 'bioText'
    | 'photoUrl'
  | 'photoStorageKey'
  | 'photoAlt'
  | 'updatedByMemberId'
  > & { updatedAt: Date },
) {
  const [result] = await db
    .update(profiles)
    .set({ ...data, revision: sql`${profiles.revision}+1` })
    .where(and(eq(profiles.id, id), eq(profiles.ludoId, ludoId), eq(profiles.revision, revision)))
    .returning({ id: profiles.id })
  if (!result) return undefined
  return getPublicProfileRowForLudo(id, ludoId)
}
export async function updatePublicProfilePublicationRow(
  id: string,
  ludoId: string,
  status: PublicContentStatus,
  revision: number,
  data: Pick<
    PublicProfileInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(profiles)
    .set({ ...data, revision: sql`${profiles.revision}+1` })
    .where(
      and(
        eq(profiles.id, id),
        eq(profiles.ludoId, ludoId),
        eq(profiles.status, status),
        eq(profiles.revision, revision),
      ),
    )
    .returning()
  return row
}
export async function updatePublicProfilePhotoRow(
  id: string,
  ludoId: string,
  revision: number,
  data: Pick<
    PublicProfileInsert,
    'photoUrl' | 'photoStorageKey' | 'photoAlt' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(profiles)
    .set({ ...data, revision: sql`${profiles.revision}+1` })
    .where(and(eq(profiles.id, id), eq(profiles.ludoId, ludoId), eq(profiles.revision, revision)))
    .returning()
  return row
}
export async function deleteDraftPublicProfileRow(id: string, ludoId: string, revision: number) {
  const [row] = await db
    .delete(profiles)
    .where(
      and(
        eq(profiles.id, id),
        eq(profiles.ludoId, ludoId),
        sql`${profiles.status} <> 'published'`,
        eq(profiles.revision, revision),
      ),
    )
    .returning({ id: profiles.id, photoStorageKey: profiles.photoStorageKey })
  return row
}

/** Suppression explicite avec contrôle de concurrence, quel que soit l’état de publication. */
export async function deletePublicProfileRow(id: string, ludoId: string, revision: number) {
  const [row] = await db
    .delete(profiles)
    .where(
      and(eq(profiles.id, id), eq(profiles.ludoId, ludoId), eq(profiles.revision, revision)),
    )
    .returning({ id: profiles.id, photoStorageKey: profiles.photoStorageKey })
  return row
}
