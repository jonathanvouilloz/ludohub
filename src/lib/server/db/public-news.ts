import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicNews,
  publicNewsSites,
  type PublicContentStatus,
  type PublicNewsInsert,
  type PublicNewsRow,
} from '../schema.js'

const newsWithRelations = {
  author: true,
  updatedBy: true,
  publishedBy: true,
  targets: { with: { site: true } },
} as const

export type PublicNewsUpdateData = Pick<
  PublicNewsInsert,
  | 'slug'
  | 'title'
  | 'summary'
  | 'body'
  | 'imageUrl'
  | 'imageStorageKey'
  | 'imageAlt'
  | 'updatedByMemberId'
>

export type PublicNewsSummaryRow = Pick<
  PublicNewsRow,
  'id' | 'ludoId' | 'slug' | 'title' | 'summary' | 'imageUrl' | 'imageAlt' | 'publishedAt'
>

export function listPublicNewsRows(ludoId: string) {
  return db.query.publicNews.findMany({
    where: eq(publicNews.ludoId, ludoId),
    with: newsWithRelations,
    orderBy: [desc(publicNews.createdAt), asc(publicNews.id)],
  })
}

export function listPublishedPublicNewsRows(ludoId: string) {
  return db.query.publicNews.findMany({
    where: and(eq(publicNews.ludoId, ludoId), eq(publicNews.status, 'published')),
    with: newsWithRelations,
    orderBy: [desc(publicNews.publishedAt), asc(publicNews.id)],
  })
}

/** Projection publique bornée : jamais de body, clé de stockage ou relations membres. */
export function listVisiblePublicNewsSummaryRows(
  ludoId: string,
  siteId: string | undefined,
  limit: number,
): Promise<PublicNewsSummaryRow[]> {
  const requestedSite = siteId ? sql`AND active.id = ${siteId}::uuid` : sql``
  return db
    .select({
      id: publicNews.id,
      ludoId: publicNews.ludoId,
      slug: publicNews.slug,
      title: publicNews.title,
      summary: publicNews.summary,
      imageUrl: publicNews.imageUrl,
      imageAlt: publicNews.imageAlt,
      publishedAt: publicNews.publishedAt,
    })
    .from(publicNews)
    .where(
      and(
        eq(publicNews.ludoId, ludoId),
        eq(publicNews.status, 'published'),
        sql`EXISTS (
          SELECT 1
          FROM ludo_sites AS active
          WHERE active.ludo_id = ${publicNews.ludoId}
            AND active.is_active = true
            ${requestedSite}
            AND (
              NOT EXISTS (
                SELECT 1 FROM public_news_sites AS any_target
                WHERE any_target.news_id = ${publicNews.id}
                  AND any_target.ludo_id = ${publicNews.ludoId}
              )
              OR EXISTS (
                SELECT 1 FROM public_news_sites AS target
                WHERE target.news_id = ${publicNews.id}
                  AND target.ludo_id = ${publicNews.ludoId}
                  AND target.site_id = active.id
              )
            )
        )`,
      ),
    )
    .orderBy(desc(publicNews.publishedAt), asc(publicNews.id))
    .limit(limit)
}

export function getPublicNewsRowForLudo(newsId: string, ludoId: string) {
  return db.query.publicNews.findFirst({
    where: and(eq(publicNews.id, newsId), eq(publicNews.ludoId, ludoId)),
    with: newsWithRelations,
  })
}

export function getPublishedPublicNewsRowBySlug(ludoId: string, slug: string) {
  return db.query.publicNews.findFirst({
    where: and(
      eq(publicNews.ludoId, ludoId),
      eq(publicNews.slug, slug),
      eq(publicNews.status, 'published'),
    ),
    with: newsWithRelations,
  })
}

export async function insertPublicNewsAtomic(
  data: PublicNewsInsert & { id: string },
  siteIds: string[],
) {
  const insertNews = db.insert(publicNews).values(data)
  if (siteIds.length === 0) {
    await insertNews
  } else {
    await db.batch([
      insertNews,
      db
        .insert(publicNewsSites)
        .values(siteIds.map((siteId) => ({ newsId: data.id, ludoId: data.ludoId, siteId }))),
    ])
  }
  return getPublicNewsRowForLudo(data.id, data.ludoId)
}

/** CAS parent + synchronisation set-diff des cibles dans une seule requête. */
export async function updatePublicNewsAtomic(
  newsId: string,
  ludoId: string,
  expectedRevision: number,
  data: PublicNewsUpdateData & { updatedAt: Date },
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
      UPDATE public_news
      SET slug = ${data.slug},
          title = ${data.title},
          summary = ${data.summary},
          body = ${data.body},
          image_url = ${data.imageUrl},
          image_storage_key = ${data.imageStorageKey},
          image_alt = ${data.imageAlt},
          updated_by_member_id = ${data.updatedByMemberId}::uuid,
          updated_at = ${data.updatedAt},
          revision = revision + 1
      WHERE id = ${newsId}::uuid
        AND ludo_id = ${ludoId}::uuid
        AND revision = ${expectedRevision}
      RETURNING id, ludo_id
    ), deleted AS (
      DELETE FROM public_news_sites AS existing
      USING updated
      WHERE existing.news_id = updated.id
        AND existing.ludo_id = updated.ludo_id
        AND NOT EXISTS (
          SELECT 1 FROM desired WHERE desired.site_id = existing.site_id
        )
      RETURNING existing.news_id
    ), inserted AS (
      INSERT INTO public_news_sites (news_id, ludo_id, site_id)
      SELECT updated.id, updated.ludo_id, desired.site_id
      FROM updated
      CROSS JOIN desired
      ON CONFLICT (news_id, site_id) DO NOTHING
      RETURNING news_id
    )
    SELECT id FROM updated
  `)
  if (result.rows.length === 0) return undefined
  return getPublicNewsRowForLudo(newsId, ludoId)
}

export async function updatePublicNewsPublicationRow(
  newsId: string,
  ludoId: string,
  expectedStatus: PublicContentStatus,
  expectedRevision: number,
  data: Pick<
    PublicNewsInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
): Promise<PublicNewsRow | undefined> {
  const [row] = await db
    .update(publicNews)
    .set({ ...data, revision: sql`${publicNews.revision} + 1` })
    .where(
      and(
        eq(publicNews.id, newsId),
        eq(publicNews.ludoId, ludoId),
        eq(publicNews.status, expectedStatus),
        eq(publicNews.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function updatePublicNewsImageRow(
  newsId: string,
  ludoId: string,
  expectedRevision: number,
  data: Pick<
    PublicNewsInsert,
    'imageUrl' | 'imageStorageKey' | 'imageAlt' | 'updatedByMemberId' | 'updatedAt'
  >,
): Promise<PublicNewsRow | undefined> {
  const [row] = await db
    .update(publicNews)
    .set({ ...data, revision: sql`${publicNews.revision} + 1` })
    .where(
      and(
        eq(publicNews.id, newsId),
        eq(publicNews.ludoId, ludoId),
        eq(publicNews.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function deletePublicNewsRow(newsId: string, ludoId: string) {
  const [row] = await db
    .delete(publicNews)
    .where(and(eq(publicNews.id, newsId), eq(publicNews.ludoId, ludoId)))
    .returning({ id: publicNews.id })
  return row
}
