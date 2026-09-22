import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicActivities,
  publicActivitySites,
  type PublicActivityInsert,
  type PublicActivityLifecycle,
  type PublicActivityRow,
  type PublicContentStatus,
} from '../schema.js'

const managementRelations = {
  author: true as const,
  updatedBy: true as const,
  publishedBy: true as const,
  targets: { with: { site: true as const } },
  assets: true as const,
}

const publicRelations = {}

const publicDetailRelations = {
  ...publicRelations,
  targets: { with: { site: true as const } },
  assets: true as const,
}

const publicColumns = {
  id: true,
  ludoId: true,
  slug: true,
  title: true,
  summary: true,
  location: true,
  type: true,
  imageUrl: true,
  imageAlt: true,
  lifecycle: true,
  featuredRank: true,
  registrationEnabled: true,
  registrationCapacity: true,
  publishedAt: true,
} as const

export type PublicActivitySummaryRow = Pick<
  PublicActivityRow,
  | 'id'
  | 'ludoId'
  | 'slug'
  | 'title'
  | 'summary'
  | 'location'
  | 'type'
  | 'imageUrl'
  | 'imageAlt'
  | 'lifecycle'
  | 'featuredRank'
  | 'publishedAt'
>
export type PublicActivityUpdateData = Pick<
  PublicActivityInsert,
  | 'slug'
  | 'title'
  | 'summary'
  | 'body'
  | 'location'
  | 'type'
  | 'updatedByMemberId'
>

export function listPublicActivityRows(ludoId: string) {
  return db.query.publicActivities.findMany({
    where: eq(publicActivities.ludoId, ludoId),
    with: managementRelations,
    orderBy: [desc(publicActivities.createdAt), asc(publicActivities.id)],
  })
}

export function getPublicActivityRowForLudo(activityId: string, ludoId: string) {
  return db.query.publicActivities.findFirst({
    where: and(eq(publicActivities.id, activityId), eq(publicActivities.ludoId, ludoId)),
    with: managementRelations,
  })
}

function publicVisibility(ludoId: string, siteId: string | undefined) {
  const requestedSite = siteId ? sql`AND active.id = ${siteId}::uuid` : sql``
  return and(
    eq(publicActivities.ludoId, ludoId),
    eq(publicActivities.status, 'published'),
    ne(publicActivities.lifecycle, 'trashed'),
    sql`EXISTS (
      SELECT 1 FROM ludo_sites AS active
      WHERE active.ludo_id = ${publicActivities.ludoId}
        AND active.is_active = true
        ${requestedSite}
        AND (
          NOT EXISTS (
            SELECT 1 FROM public_activity_sites AS any_target
            WHERE any_target.activity_id = ${publicActivities.id}
              AND any_target.ludo_id = ${publicActivities.ludoId}
          )
          OR EXISTS (
            SELECT 1 FROM public_activity_sites AS target
            WHERE target.activity_id = ${publicActivities.id}
              AND target.ludo_id = ${publicActivities.ludoId}
              AND target.site_id = active.id
          )
        )
    )`,
  )
}

export function listVisiblePublicActivitySummaryRows(
  ludoId: string,
  siteId: string | undefined,
  lifecycle: 'active' | 'archived',
  limit: number,
): Promise<PublicActivitySummaryRow[]> {
  return db
    .select({
      id: publicActivities.id,
      ludoId: publicActivities.ludoId,
      slug: publicActivities.slug,
      title: publicActivities.title,
      summary: publicActivities.summary,
      location: publicActivities.location,
      type: publicActivities.type,
      imageUrl: publicActivities.imageUrl,
      imageAlt: publicActivities.imageAlt,
      lifecycle: publicActivities.lifecycle,
      featuredRank: publicActivities.featuredRank,
      publishedAt: publicActivities.publishedAt,
    })
    .from(publicActivities)
    .where(and(publicVisibility(ludoId, siteId), eq(publicActivities.lifecycle, lifecycle)))
    .orderBy(
      sql`${publicActivities.featuredRank} asc nulls last`,
      desc(publicActivities.publishedAt),
      asc(publicActivities.id),
    )
    .limit(limit)
}

export function getVisiblePublicActivityRowBySlug(
  ludoId: string,
  slug: string,
  siteId: string | undefined,
) {
  return db.query.publicActivities.findFirst({
    where: and(
      publicVisibility(ludoId, siteId),
      inArray(publicActivities.lifecycle, ['active', 'archived']),
      eq(publicActivities.slug, slug),
    ),
    columns: { ...publicColumns, body: true },
    with: publicDetailRelations,
  })
}

export async function insertPublicActivityAtomic(
  data: PublicActivityInsert & { id: string },
  siteIds: string[],
  _legacyDates?: unknown,
  _legacyExceptions?: unknown,
) {
  const queries = [db.insert(publicActivities).values(data)]
  if (siteIds.length) {
    queries.push(
      db
        .insert(publicActivitySites)
        .values(
          siteIds.map((siteId) => ({ activityId: data.id, ludoId: data.ludoId, siteId })),
        ) as never,
    )
  }
  if (queries.length === 1) await queries[0]
  else await db.batch(queries as never)
  return getPublicActivityRowForLudo(data.id, data.ludoId)
}

/** CAS parent + set-diff atomique des lieux ciblés. */
export async function updatePublicActivityAtomic(
  activityId: string,
  ludoId: string,
  expectedRevision: number,
  data: PublicActivityUpdateData & { updatedAt: Date },
  siteIds: string[],
  _legacyDates?: unknown,
  _legacyExceptions?: unknown,
) {
  const desiredSites =
    siteIds.length === 0
      ? sql`SELECT null::uuid AS site_id WHERE false`
      : sql`VALUES ${sql.join(
          siteIds.map((siteId) => sql`(${siteId}::uuid)`),
          sql`, `,
        )}`
  const result = await db.execute<{ id: string }>(sql`
    WITH desired_sites(site_id) AS (${desiredSites}),
    updated AS (
      UPDATE public_activities
      SET slug = ${data.slug}, title = ${data.title}, summary = ${data.summary},
          body = ${data.body}, location = ${data.location}, type = ${data.type},
          updated_by_member_id = ${data.updatedByMemberId}::uuid,
          updated_at = ${data.updatedAt}, revision = revision + 1
      WHERE id = ${activityId}::uuid AND ludo_id = ${ludoId}::uuid
        AND revision = ${expectedRevision}
      RETURNING id, ludo_id
    ), deleted_sites AS (
      DELETE FROM public_activity_sites AS existing USING updated
      WHERE existing.activity_id = updated.id AND existing.ludo_id = updated.ludo_id
        AND NOT EXISTS (SELECT 1 FROM desired_sites d WHERE d.site_id = existing.site_id)
    ), inserted_sites AS (
      INSERT INTO public_activity_sites (activity_id, ludo_id, site_id)
      SELECT updated.id, updated.ludo_id, desired_sites.site_id FROM updated CROSS JOIN desired_sites
      ON CONFLICT (activity_id, site_id) DO NOTHING
    )
    SELECT id FROM updated
  `)
  if (result.rows.length === 0) return undefined
  return getPublicActivityRowForLudo(activityId, ludoId)
}

export async function updatePublicActivityPublicationRow(
  activityId: string,
  ludoId: string,
  expectedStatus: PublicContentStatus,
  expectedRevision: number,
  data: Pick<
    PublicActivityInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
): Promise<PublicActivityRow | undefined> {
  const [row] = await db
    .update(publicActivities)
    .set({
      ...data,
      featuredRank: data.status === 'published' ? undefined : null,
      revision: sql`${publicActivities.revision} + 1`,
    })
    .where(
      and(
        eq(publicActivities.id, activityId),
        eq(publicActivities.ludoId, ludoId),
        eq(publicActivities.status, expectedStatus),
        eq(publicActivities.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function updatePublicActivityLifecycleRow(
  activityId: string,
  ludoId: string,
  expectedLifecycle: PublicActivityLifecycle,
  expectedRevision: number,
  data: Partial<
    Pick<
      PublicActivityInsert,
      | 'lifecycle'
      | 'status'
      | 'featuredRank'
      | 'archivedAt'
      | 'trashedAt'
      | 'updatedByMemberId'
      | 'updatedAt'
    >
  >,
) {
  const [row] = await db
    .update(publicActivities)
    .set({ ...data, revision: sql`${publicActivities.revision} + 1` })
    .where(
      and(
        eq(publicActivities.id, activityId),
        eq(publicActivities.ludoId, ludoId),
        eq(publicActivities.lifecycle, expectedLifecycle),
        eq(publicActivities.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function updatePublicActivityFeaturedRow(
  activityId: string,
  ludoId: string,
  expectedRevision: number,
  featuredRank: number | null,
  memberId: string,
  updatedAt: Date,
) {
  const [row] = await db
    .update(publicActivities)
    .set({
      featuredRank,
      updatedByMemberId: memberId,
      updatedAt,
      revision: sql`${publicActivities.revision} + 1`,
    })
    .where(
      and(
        eq(publicActivities.id, activityId),
        eq(publicActivities.ludoId, ludoId),
        eq(publicActivities.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function updatePublicActivityImageRow(
  activityId: string,
  ludoId: string,
  expectedRevision: number,
  data: Pick<
    PublicActivityInsert,
    'imageUrl' | 'imageStorageKey' | 'imageAlt' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(publicActivities)
    .set({ ...data, revision: sql`${publicActivities.revision} + 1` })
    .where(
      and(
        eq(publicActivities.id, activityId),
        eq(publicActivities.ludoId, ludoId),
        eq(publicActivities.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function permanentlyDeletePublicActivityRow(
  activityId: string,
  ludoId: string,
  expectedRevision: number,
) {
  const [row] = await db
    .delete(publicActivities)
    .where(
      and(
        eq(publicActivities.id, activityId),
        eq(publicActivities.ludoId, ludoId),
        eq(publicActivities.lifecycle, 'trashed'),
        eq(publicActivities.revision, expectedRevision),
      ),
    )
    .returning({ id: publicActivities.id })
  return row
}
