import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicProfiles as profiles,
  publicProfileSites as sites,
  type PublicContentStatus,
  type PublicProfileInsert,
  type PublicProfileSection,
} from '../schema.js'
const withRelations = {
  author: true,
  updatedBy: true,
  publishedBy: true,
  targets: { with: { site: true } },
} as const
export const listPublicProfileRows = (ludoId: string) =>
  db.query.publicProfiles.findMany({
    where: eq(profiles.ludoId, ludoId),
    with: withRelations,
    orderBy: [asc(profiles.section), asc(profiles.sortOrder), asc(profiles.id)],
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
      bioMarkdown: profiles.bioMarkdown,
      sortOrder: profiles.sortOrder,
      photoUrl: profiles.photoUrl,
      photoAlt: profiles.photoAlt,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.ludoId, ludoId),
        eq(profiles.status, 'published'),
        section ? eq(profiles.section, section) : undefined,
        sql`EXISTS(SELECT 1 FROM ludo_sites active WHERE active.ludo_id=${profiles.ludoId} AND active.is_active=true ${requested} AND (NOT EXISTS(SELECT 1 FROM public_profile_sites x WHERE x.profile_id=${profiles.id} AND x.ludo_id=${profiles.ludoId}) OR EXISTS(SELECT 1 FROM public_profile_sites x WHERE x.profile_id=${profiles.id} AND x.ludo_id=${profiles.ludoId} AND x.site_id=active.id)))`,
      ),
    )
    .orderBy(asc(profiles.section), asc(profiles.sortOrder), asc(profiles.id))
    .limit(limit)
}
export async function insertPublicProfileAtomic(
  data: PublicProfileInsert & { id: string },
  siteIds: string[],
) {
  const parent = db.insert(profiles).values(data)
  if (!siteIds.length) await parent
  else
    await db.batch([
      parent,
      db
        .insert(sites)
        .values(siteIds.map((siteId) => ({ profileId: data.id, ludoId: data.ludoId, siteId }))),
    ])
  return getPublicProfileRowForLudo(data.id, data.ludoId)
}
export async function updatePublicProfileAtomic(
  id: string,
  ludoId: string,
  revision: number,
  data: Pick<
    PublicProfileInsert,
    | 'memberId'
    | 'section'
    | 'displayName'
    | 'roleTitle'
    | 'bioMarkdown'
    | 'sortOrder'
    | 'photoUrl'
    | 'photoStorageKey'
    | 'photoAlt'
    | 'updatedByMemberId'
  > & { updatedAt: Date },
  siteIds: string[],
) {
  const desired = siteIds.length
    ? sql`VALUES ${sql.join(
        siteIds.map((x) => sql`(${x}::uuid)`),
        sql`, `,
      )}`
    : sql`SELECT null::uuid AS site_id WHERE false`
  const result = await db.execute(
    sql`WITH desired(site_id) AS(${desired}),updated AS(UPDATE public_profiles SET member_id=${data.memberId}::uuid,section=${data.section},display_name=${data.displayName},role_title=${data.roleTitle},bio_markdown=${data.bioMarkdown},sort_order=${data.sortOrder},photo_url=${data.photoUrl},photo_storage_key=${data.photoStorageKey},photo_alt=${data.photoAlt},updated_by_member_id=${data.updatedByMemberId}::uuid,updated_at=${data.updatedAt},revision=revision+1 WHERE id=${id}::uuid AND ludo_id=${ludoId}::uuid AND revision=${revision} RETURNING id,ludo_id),deleted AS(DELETE FROM public_profile_sites x USING updated WHERE x.profile_id=updated.id AND x.ludo_id=updated.ludo_id AND NOT EXISTS(SELECT 1 FROM desired WHERE desired.site_id=x.site_id)),inserted AS(INSERT INTO public_profile_sites(profile_id,ludo_id,site_id) SELECT updated.id,updated.ludo_id,desired.site_id FROM updated CROSS JOIN desired ON CONFLICT(profile_id,site_id) DO NOTHING)SELECT id FROM updated`,
  )
  if (!result.rows.length) return undefined
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
        eq(profiles.status, 'draft'),
        eq(profiles.revision, revision),
      ),
    )
    .returning({ id: profiles.id, photoStorageKey: profiles.photoStorageKey })
  return row
}
