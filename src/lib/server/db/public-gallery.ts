import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicGalleryImages as images,
  publicGalleryImageSites as sites,
  type PublicContentStatus,
  type PublicGalleryImageInsert,
} from '../schema.js'
const withRelations = {
  author: true,
  updatedBy: true,
  publishedBy: true,
  targets: { with: { site: true } },
} as const
export const listPublicGalleryRows = (ludoId: string) =>
  db.query.publicGalleryImages.findMany({
    where: eq(images.ludoId, ludoId),
    with: withRelations,
    orderBy: [asc(images.sortOrder), asc(images.id)],
  })
export const getPublicGalleryRowForLudo = (id: string, ludoId: string) =>
  db.query.publicGalleryImages.findFirst({
    where: and(eq(images.id, id), eq(images.ludoId, ludoId)),
    with: withRelations,
  })
export function listVisiblePublicGalleryRows(
  ludoId: string,
  siteId: string | undefined,
  limit: number,
) {
  const requested = siteId ? sql`AND active.id=${siteId}::uuid` : sql``
  return db
    .select({
      id: images.id,
      ludoId: images.ludoId,
      caption: images.caption,
      alt: images.alt,
      sortOrder: images.sortOrder,
      imageUrl: images.imageUrl,
      publishedAt: images.publishedAt,
    })
    .from(images)
    .where(
      and(
        eq(images.ludoId, ludoId),
        eq(images.status, 'published'),
        sql`EXISTS(SELECT 1 FROM ludo_sites active WHERE active.ludo_id=${images.ludoId} AND active.is_active=true ${requested} AND (NOT EXISTS(SELECT 1 FROM public_gallery_image_sites x WHERE x.image_id=${images.id} AND x.ludo_id=${images.ludoId}) OR EXISTS(SELECT 1 FROM public_gallery_image_sites x WHERE x.image_id=${images.id} AND x.ludo_id=${images.ludoId} AND x.site_id=active.id)))`,
      ),
    )
    .orderBy(asc(images.sortOrder), asc(images.id))
    .limit(limit)
}
export async function insertPublicGalleryAtomic(
  data: PublicGalleryImageInsert & { id: string },
  siteIds: string[],
) {
  const parent = db.insert(images).values(data)
  if (!siteIds.length) await parent
  else
    await db.batch([
      parent,
      db
        .insert(sites)
        .values(siteIds.map((siteId) => ({ imageId: data.id, ludoId: data.ludoId, siteId }))),
    ])
  return getPublicGalleryRowForLudo(data.id, data.ludoId)
}
export async function updatePublicGalleryAtomic(
  id: string,
  ludoId: string,
  revision: number,
  data: Pick<
    PublicGalleryImageInsert,
    'caption' | 'alt' | 'sortOrder' | 'imageUrl' | 'imageStorageKey' | 'updatedByMemberId'
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
    sql`WITH desired(site_id) AS (${desired}),updated AS(UPDATE public_gallery_images SET caption=${data.caption},alt=${data.alt},sort_order=${data.sortOrder},image_url=${data.imageUrl},image_storage_key=${data.imageStorageKey},updated_by_member_id=${data.updatedByMemberId}::uuid,updated_at=${data.updatedAt},revision=revision+1 WHERE id=${id}::uuid AND ludo_id=${ludoId}::uuid AND revision=${revision} RETURNING id,ludo_id),deleted AS(DELETE FROM public_gallery_image_sites x USING updated WHERE x.image_id=updated.id AND x.ludo_id=updated.ludo_id AND NOT EXISTS(SELECT 1 FROM desired WHERE desired.site_id=x.site_id)),inserted AS(INSERT INTO public_gallery_image_sites(image_id,ludo_id,site_id) SELECT updated.id,updated.ludo_id,desired.site_id FROM updated CROSS JOIN desired ON CONFLICT(image_id,site_id) DO NOTHING) SELECT id FROM updated`,
  )
  if (!result.rows.length) return undefined
  return getPublicGalleryRowForLudo(id, ludoId)
}
export async function updatePublicGalleryPublicationRow(
  id: string,
  ludoId: string,
  status: PublicContentStatus,
  revision: number,
  data: Pick<
    PublicGalleryImageInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(images)
    .set({ ...data, revision: sql`${images.revision}+1` })
    .where(
      and(
        eq(images.id, id),
        eq(images.ludoId, ludoId),
        eq(images.status, status),
        eq(images.revision, revision),
      ),
    )
    .returning()
  return row
}
export async function updatePublicGalleryFileRow(
  id: string,
  ludoId: string,
  revision: number,
  data: Pick<
    PublicGalleryImageInsert,
    'imageUrl' | 'imageStorageKey' | 'alt' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(images)
    .set({ ...data, revision: sql`${images.revision}+1` })
    .where(and(eq(images.id, id), eq(images.ludoId, ludoId), eq(images.revision, revision)))
    .returning()
  return row
}
export async function deleteDraftPublicGalleryRow(id: string, ludoId: string, revision: number) {
  const [row] = await db
    .delete(images)
    .where(
      and(
        eq(images.id, id),
        eq(images.ludoId, ludoId),
        eq(images.status, 'draft'),
        eq(images.revision, revision),
      ),
    )
    .returning({ id: images.id, imageStorageKey: images.imageStorageKey })
  return row
}
