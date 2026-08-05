import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicActivities,
  publicActivityDates,
  publicActivityExceptions,
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
  dates: { orderBy: [asc(publicActivityDates.startsAt)] },
  exceptions: { orderBy: [asc(publicActivityExceptions.excludedAt)] },
}

const publicRelations = {
  dates: { orderBy: [asc(publicActivityDates.startsAt)] },
  exceptions: { orderBy: [asc(publicActivityExceptions.excludedAt)] },
}

const publicDetailRelations = {
  ...publicRelations,
  targets: { with: { site: true as const } },
}

const publicColumns = {
  id: true,
  ludoId: true,
  slug: true,
  title: true,
  summary: true,
  location: true,
  type: true,
  recurrenceRule: true,
  imageUrl: true,
  imageAlt: true,
  lifecycle: true,
  featuredRank: true,
  publishedAt: true,
} as const

export type PublicActivitySummaryDate = { startsAt: string; endsAt: string | null }
export type PublicActivitySummaryRow = Pick<
  PublicActivityRow,
  | 'id'
  | 'ludoId'
  | 'slug'
  | 'title'
  | 'summary'
  | 'location'
  | 'type'
  | 'recurrenceRule'
  | 'imageUrl'
  | 'imageAlt'
  | 'lifecycle'
  | 'featuredRank'
  | 'publishedAt'
> & { dates: PublicActivitySummaryDate[] }

export type ActivityDateInput = { startsAt: Date; endsAt: Date | null }
export type ActivityExceptionInput = { excludedAt: Date; reason: string | null }
export type PublicActivityUpdateData = Pick<
  PublicActivityInsert,
  | 'slug'
  | 'title'
  | 'summary'
  | 'body'
  | 'location'
  | 'type'
  | 'recurrenceRule'
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
      recurrenceRule: publicActivities.recurrenceRule,
      imageUrl: publicActivities.imageUrl,
      imageAlt: publicActivities.imageAlt,
      lifecycle: publicActivities.lifecycle,
      featuredRank: publicActivities.featuredRank,
      publishedAt: publicActivities.publishedAt,
      dates: sql<PublicActivitySummaryDate[]>`coalesce((
        SELECT jsonb_agg(
          jsonb_build_object('startsAt', occurrence.starts_at, 'endsAt', occurrence.ends_at)
          ORDER BY occurrence.starts_at
        )
        FROM (
          SELECT starts_at, ends_at
          FROM public_activity_dates
          WHERE activity_id = ${publicActivities.id}
            AND ludo_id = ${publicActivities.ludoId}
          ORDER BY starts_at
          LIMIT 3
        ) AS occurrence
      ), '[]'::jsonb)`,
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
  dates: ActivityDateInput[],
  exceptions: ActivityExceptionInput[],
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
  if (dates.length) {
    queries.push(
      db
        .insert(publicActivityDates)
        .values(
          dates.map((date) => ({ ...date, activityId: data.id, ludoId: data.ludoId })),
        ) as never,
    )
  }
  if (exceptions.length) {
    queries.push(
      db.insert(publicActivityExceptions).values(
        exceptions.map((exception) => ({
          ...exception,
          activityId: data.id,
          ludoId: data.ludoId,
        })),
      ) as never,
    )
  }
  if (queries.length === 1) await queries[0]
  else await db.batch(queries as never)
  return getPublicActivityRowForLudo(data.id, data.ludoId)
}

/** CAS parent + set-diff atomique des sites, occurrences et exceptions. */
export async function updatePublicActivityAtomic(
  activityId: string,
  ludoId: string,
  expectedRevision: number,
  data: PublicActivityUpdateData & { updatedAt: Date },
  siteIds: string[],
  dates: ActivityDateInput[],
  exceptions: ActivityExceptionInput[],
) {
  const desiredSites =
    siteIds.length === 0
      ? sql`SELECT null::uuid AS site_id WHERE false`
      : sql`VALUES ${sql.join(
          siteIds.map((siteId) => sql`(${siteId}::uuid)`),
          sql`, `,
        )}`
  const desiredDates =
    dates.length === 0
      ? sql`SELECT null::timestamptz AS starts_at, null::timestamptz AS ends_at WHERE false`
      : sql`VALUES ${sql.join(
          dates.map((date) => sql`(${date.startsAt}::timestamptz, ${date.endsAt}::timestamptz)`),
          sql`, `,
        )}`
  const desiredExceptions =
    exceptions.length === 0
      ? sql`SELECT null::timestamptz AS excluded_at, null::text AS reason WHERE false`
      : sql`VALUES ${sql.join(
          exceptions.map(
            (exception) => sql`(${exception.excludedAt}::timestamptz, ${exception.reason}::text)`,
          ),
          sql`, `,
        )}`

  const result = await db.execute<{ id: string }>(sql`
    WITH desired_sites(site_id) AS (${desiredSites}),
    desired_dates(starts_at, ends_at) AS (${desiredDates}),
    desired_exceptions(excluded_at, reason) AS (${desiredExceptions}),
    updated AS (
      UPDATE public_activities
      SET slug = ${data.slug}, title = ${data.title}, summary = ${data.summary},
          body = ${data.body}, location = ${data.location}, type = ${data.type},
          recurrence_rule = ${data.recurrenceRule},
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
    ), deleted_dates AS (
      DELETE FROM public_activity_dates AS existing USING updated
      WHERE existing.activity_id = updated.id AND existing.ludo_id = updated.ludo_id
        AND NOT EXISTS (SELECT 1 FROM desired_dates d WHERE d.starts_at = existing.starts_at)
    ), inserted_dates AS (
      INSERT INTO public_activity_dates (activity_id, ludo_id, starts_at, ends_at)
      SELECT updated.id, updated.ludo_id, d.starts_at, d.ends_at FROM updated CROSS JOIN desired_dates d
      ON CONFLICT (activity_id, starts_at) DO UPDATE SET ends_at = excluded.ends_at
    ), deleted_exceptions AS (
      DELETE FROM public_activity_exceptions AS existing USING updated
      WHERE existing.activity_id = updated.id AND existing.ludo_id = updated.ludo_id
        AND NOT EXISTS (
          SELECT 1 FROM desired_exceptions d WHERE d.excluded_at = existing.excluded_at
        )
    ), inserted_exceptions AS (
      INSERT INTO public_activity_exceptions (activity_id, ludo_id, excluded_at, reason)
      SELECT updated.id, updated.ludo_id, d.excluded_at, d.reason
      FROM updated CROSS JOIN desired_exceptions d
      ON CONFLICT (activity_id, excluded_at) DO UPDATE SET reason = excluded.reason
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
