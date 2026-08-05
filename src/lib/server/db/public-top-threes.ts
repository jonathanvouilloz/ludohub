import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicTopThrees,
  publicTopThreeSites,
  type PublicContentStatus,
  type PublicTopThreeGame,
  type PublicTopThreeInsert,
  type PublicTopThreeRow,
} from '../schema.js'

const withRelations = {
  author: true,
  updatedBy: true,
  publishedBy: true,
  targets: { with: { site: true } },
} as const

export type PublicTopThreeUpdateData = Pick<
  PublicTopThreeInsert,
  'slug' | 'theme' | 'games' | 'updatedByMemberId'
>

export type PublicTopThreeSummaryRow = Pick<
  PublicTopThreeRow,
  'id' | 'ludoId' | 'slug' | 'theme' | 'isHomepage' | 'publishedAt'
> & { games: Array<Pick<PublicTopThreeGame, 'name'>> }

export function listPublicTopThreeRows(ludoId: string) {
  return db.query.publicTopThrees.findMany({
    where: eq(publicTopThrees.ludoId, ludoId),
    with: withRelations,
    orderBy: [desc(publicTopThrees.createdAt), asc(publicTopThrees.id)],
  })
}

/** Projection publique bornée : noms des jeux uniquement, aucune description ni membre. */
export function listVisiblePublicTopThreeSummaryRows(
  ludoId: string,
  siteId: string | undefined,
  limit: number,
): Promise<PublicTopThreeSummaryRow[]> {
  const requestedSite = siteId ? sql`AND active.id = ${siteId}::uuid` : sql``
  return db
    .select({
      id: publicTopThrees.id,
      ludoId: publicTopThrees.ludoId,
      slug: publicTopThrees.slug,
      theme: publicTopThrees.theme,
      isHomepage: publicTopThrees.isHomepage,
      games: sql<Array<{ name: string }>>`(
        SELECT jsonb_agg(jsonb_build_object('name', game.value->>'name') ORDER BY game.ordinality)
        FROM jsonb_array_elements(${publicTopThrees.games}) WITH ORDINALITY AS game(value, ordinality)
      )`,
      publishedAt: publicTopThrees.publishedAt,
    })
    .from(publicTopThrees)
    .where(
      and(
        eq(publicTopThrees.ludoId, ludoId),
        eq(publicTopThrees.status, 'published'),
        sql`EXISTS (
          SELECT 1 FROM ludo_sites AS active
          WHERE active.ludo_id = ${publicTopThrees.ludoId}
            AND active.is_active = true ${requestedSite}
            AND (
              NOT EXISTS (
                SELECT 1 FROM public_top_three_sites AS any_target
                WHERE any_target.top_three_id = ${publicTopThrees.id}
                  AND any_target.ludo_id = ${publicTopThrees.ludoId}
              ) OR EXISTS (
                SELECT 1 FROM public_top_three_sites AS target
                WHERE target.top_three_id = ${publicTopThrees.id}
                  AND target.ludo_id = ${publicTopThrees.ludoId}
                  AND target.site_id = active.id
              )
            )
        )`,
      ),
    )
    .orderBy(desc(publicTopThrees.publishedAt), asc(publicTopThrees.id))
    .limit(limit)
}

export function getPublicTopThreeRowForLudo(topThreeId: string, ludoId: string) {
  return db.query.publicTopThrees.findFirst({
    where: and(eq(publicTopThrees.id, topThreeId), eq(publicTopThrees.ludoId, ludoId)),
    with: withRelations,
  })
}

export function getPublishedPublicTopThreeRowBySlug(ludoId: string, slug: string) {
  return db.query.publicTopThrees.findFirst({
    where: and(
      eq(publicTopThrees.ludoId, ludoId),
      eq(publicTopThrees.slug, slug),
      eq(publicTopThrees.status, 'published'),
    ),
    columns: {
      id: true,
      ludoId: true,
      slug: true,
      theme: true,
      games: true,
      isHomepage: true,
      publishedAt: true,
    },
    with: {
      targets: {
        columns: { ludoId: true, siteId: true },
        with: { site: true },
      },
    },
  })
}

export async function insertPublicTopThreeAtomic(
  data: PublicTopThreeInsert & { id: string },
  siteIds: string[],
) {
  const parent = db.insert(publicTopThrees).values(data)
  if (siteIds.length === 0) await parent
  else
    await db.batch([
      parent,
      db
        .insert(publicTopThreeSites)
        .values(siteIds.map((siteId) => ({ topThreeId: data.id, ludoId: data.ludoId, siteId }))),
    ])
  return getPublicTopThreeRowForLudo(data.id, data.ludoId)
}

/** CAS parent + set-diff des cibles dans une requête atomique. */
export async function updatePublicTopThreeAtomic(
  topThreeId: string,
  ludoId: string,
  expectedRevision: number,
  data: PublicTopThreeUpdateData & { updatedAt: Date },
  siteIds: string[],
) {
  const desired =
    siteIds.length === 0
      ? sql`SELECT null::uuid AS site_id WHERE false`
      : sql`VALUES ${sql.join(
          siteIds.map((id) => sql`(${id}::uuid)`),
          sql`, `,
        )}`
  const result = await db.execute<{ id: string }>(sql`
    WITH desired(site_id) AS (${desired}), updated AS (
      UPDATE public_top_threes
      SET slug = ${data.slug}, theme = ${data.theme}, games = ${JSON.stringify(data.games)}::jsonb,
          updated_by_member_id = ${data.updatedByMemberId}::uuid,
          updated_at = ${data.updatedAt}, revision = revision + 1
      WHERE id = ${topThreeId}::uuid AND ludo_id = ${ludoId}::uuid
        AND revision = ${expectedRevision}
      RETURNING id, ludo_id
    ), deleted AS (
      DELETE FROM public_top_three_sites AS existing USING updated
      WHERE existing.top_three_id = updated.id AND existing.ludo_id = updated.ludo_id
        AND NOT EXISTS (SELECT 1 FROM desired WHERE desired.site_id = existing.site_id)
    ), inserted AS (
      INSERT INTO public_top_three_sites (top_three_id, ludo_id, site_id)
      SELECT updated.id, updated.ludo_id, desired.site_id FROM updated CROSS JOIN desired
      ON CONFLICT (top_three_id, site_id) DO NOTHING
    ) SELECT id FROM updated
  `)
  if (result.rows.length === 0) return undefined
  return getPublicTopThreeRowForLudo(topThreeId, ludoId)
}

export async function updatePublicTopThreePublicationRow(
  topThreeId: string,
  ludoId: string,
  expectedStatus: PublicContentStatus,
  expectedRevision: number,
  data: Pick<
    PublicTopThreeInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(publicTopThrees)
    .set({
      ...data,
      ...(data.status === 'hidden' ? { isHomepage: false } : {}),
      revision: sql`${publicTopThrees.revision} + 1`,
    })
    .where(
      and(
        eq(publicTopThrees.id, topThreeId),
        eq(publicTopThrees.ludoId, ludoId),
        eq(publicTopThrees.status, expectedStatus),
        eq(publicTopThrees.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

/**
 * `neon-http` ne fournit pas de transaction callback ; `db.batch` délègue à la
 * transaction wire Neon. Les quatre requêtes restent donc dans la même transaction,
 * dans cet ordre : verrou tenant, validation verrouillée, clear, sélection.
 */
export async function selectPublicTopThreeHomepageAtomic(
  topThreeId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  updatedAt: Date,
) {
  const candidatePredicate = sql`
    candidate.id = ${topThreeId}::uuid AND candidate.ludo_id = ${ludoId}::uuid
    AND candidate.status = 'published' AND candidate.revision = ${expectedRevision}
    AND candidate.is_homepage = false
  `
  try {
    const [, candidate, , selected] = await db.batch([
      db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${ludoId}::text, 0))`),
      db.execute<{ id: string }>(sql`
        SELECT candidate.id FROM public_top_threes AS candidate
        WHERE ${candidatePredicate}
        FOR UPDATE
      `),
      db.execute<{ id: string }>(sql`
        UPDATE public_top_threes AS previous
        SET is_homepage = false, revision = previous.revision + 1,
            updated_by_member_id = ${memberId}::uuid, updated_at = ${updatedAt}
        WHERE previous.ludo_id = ${ludoId}::uuid AND previous.is_homepage = true
          AND previous.id <> ${topThreeId}::uuid
          AND EXISTS (
            SELECT 1 FROM public_top_threes AS candidate WHERE ${candidatePredicate}
          )
        RETURNING previous.id
      `),
      db.execute<{ id: string }>(sql`
        UPDATE public_top_threes AS candidate
        SET is_homepage = true, revision = candidate.revision + 1,
            updated_by_member_id = ${memberId}::uuid, updated_at = ${updatedAt}
        WHERE ${candidatePredicate}
        RETURNING candidate.id
      `),
    ])
    if (candidate.rows.length === 0 || selected.rows.length === 0) return undefined
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === '23505' || error.code === '23514')
    ) {
      return undefined
    }
    throw error
  }
  return getPublicTopThreeRowForLudo(topThreeId, ludoId)
}

export async function deselectPublicTopThreeHomepageRow(
  topThreeId: string,
  ludoId: string,
  memberId: string,
  expectedRevision: number,
  updatedAt: Date,
) {
  const [row] = await db
    .update(publicTopThrees)
    .set({
      isHomepage: false,
      updatedByMemberId: memberId,
      updatedAt,
      revision: sql`${publicTopThrees.revision} + 1`,
    })
    .where(
      and(
        eq(publicTopThrees.id, topThreeId),
        eq(publicTopThrees.ludoId, ludoId),
        eq(publicTopThrees.status, 'published'),
        eq(publicTopThrees.isHomepage, true),
        eq(publicTopThrees.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function deleteDraftPublicTopThreeRow(
  topThreeId: string,
  ludoId: string,
  expectedRevision: number,
) {
  const [row] = await db
    .delete(publicTopThrees)
    .where(
      and(
        eq(publicTopThrees.id, topThreeId),
        eq(publicTopThrees.ludoId, ludoId),
        eq(publicTopThrees.status, 'draft'),
        eq(publicTopThrees.revision, expectedRevision),
      ),
    )
    .returning({ id: publicTopThrees.id })
  return row
}
