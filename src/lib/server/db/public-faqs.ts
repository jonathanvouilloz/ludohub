import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicFaqs,
  publicFaqSites,
  type PublicContentStatus,
  type PublicFaqInsert,
} from '../schema.js'

const withRelations = {
  author: true,
  updatedBy: true,
  publishedBy: true,
  targets: { with: { site: true } },
} as const

export const listPublicFaqRows = (ludoId: string) =>
  db.query.publicFaqs.findMany({
    where: eq(publicFaqs.ludoId, ludoId),
    with: withRelations,
    orderBy: [asc(publicFaqs.sortOrder), asc(publicFaqs.id)],
  })
export const getPublicFaqRowForLudo = (id: string, ludoId: string) =>
  db.query.publicFaqs.findFirst({
    where: and(eq(publicFaqs.id, id), eq(publicFaqs.ludoId, ludoId)),
    with: withRelations,
  })

export function listVisiblePublicFaqRows(
  ludoId: string,
  siteId: string | undefined,
  limit: number,
) {
  const requested = siteId ? sql`AND active.id = ${siteId}::uuid` : sql``
  return db
    .select({
      id: publicFaqs.id,
      ludoId: publicFaqs.ludoId,
      question: publicFaqs.question,
      answerMarkdown: publicFaqs.answerMarkdown,
      category: publicFaqs.category,
      sortOrder: publicFaqs.sortOrder,
    })
    .from(publicFaqs)
    .where(
      and(
        eq(publicFaqs.ludoId, ludoId),
        eq(publicFaqs.status, 'published'),
        sql`EXISTS (SELECT 1 FROM ludo_sites active WHERE active.ludo_id = ${publicFaqs.ludoId} AND active.is_active = true ${requested} AND (NOT EXISTS (SELECT 1 FROM public_faq_sites x WHERE x.faq_id = ${publicFaqs.id} AND x.ludo_id = ${publicFaqs.ludoId}) OR EXISTS (SELECT 1 FROM public_faq_sites x WHERE x.faq_id = ${publicFaqs.id} AND x.ludo_id = ${publicFaqs.ludoId} AND x.site_id = active.id)))`,
      ),
    )
    .orderBy(asc(publicFaqs.sortOrder), asc(publicFaqs.id))
    .limit(limit)
}

export async function insertPublicFaqAtomic(
  data: PublicFaqInsert & { id: string },
  siteIds: string[],
) {
  const parent = db.insert(publicFaqs).values(data)
  if (!siteIds.length) await parent
  else
    await db.batch([
      parent,
      db
        .insert(publicFaqSites)
        .values(siteIds.map((siteId) => ({ faqId: data.id, ludoId: data.ludoId, siteId }))),
    ])
  return getPublicFaqRowForLudo(data.id, data.ludoId)
}

export async function updatePublicFaqAtomic(
  id: string,
  ludoId: string,
  expectedRevision: number,
  data: Pick<
    PublicFaqInsert,
    'question' | 'answerMarkdown' | 'category' | 'sortOrder' | 'updatedByMemberId'
  > & { updatedAt: Date },
  siteIds: string[],
) {
  const desired = siteIds.length
    ? sql`VALUES ${sql.join(
        siteIds.map((siteId) => sql`(${siteId}::uuid)`),
        sql`, `,
      )}`
    : sql`SELECT null::uuid AS site_id WHERE false`
  const result = await db.execute(
    sql`WITH desired(site_id) AS (${desired}), updated AS (UPDATE public_faqs SET question=${data.question}, answer_markdown=${data.answerMarkdown}, category=${data.category}, sort_order=${data.sortOrder}, updated_by_member_id=${data.updatedByMemberId}::uuid, updated_at=${data.updatedAt}, revision=revision+1 WHERE id=${id}::uuid AND ludo_id=${ludoId}::uuid AND revision=${expectedRevision} RETURNING id,ludo_id), deleted AS (DELETE FROM public_faq_sites x USING updated WHERE x.faq_id=updated.id AND x.ludo_id=updated.ludo_id AND NOT EXISTS (SELECT 1 FROM desired WHERE desired.site_id=x.site_id)), inserted AS (INSERT INTO public_faq_sites(faq_id,ludo_id,site_id) SELECT updated.id,updated.ludo_id,desired.site_id FROM updated CROSS JOIN desired ON CONFLICT(faq_id,site_id) DO NOTHING) SELECT id FROM updated`,
  )
  if (!result.rows.length) return undefined
  return getPublicFaqRowForLudo(id, ludoId)
}

export async function updatePublicFaqPublicationRow(
  id: string,
  ludoId: string,
  expectedStatus: PublicContentStatus,
  expectedRevision: number,
  data: Pick<
    PublicFaqInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(publicFaqs)
    .set({ ...data, revision: sql`${publicFaqs.revision}+1` })
    .where(
      and(
        eq(publicFaqs.id, id),
        eq(publicFaqs.ludoId, ludoId),
        eq(publicFaqs.status, expectedStatus),
        eq(publicFaqs.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function deleteDraftPublicFaqRow(id: string, ludoId: string, revision: number) {
  const [row] = await db
    .delete(publicFaqs)
    .where(
      and(
        eq(publicFaqs.id, id),
        eq(publicFaqs.ludoId, ludoId),
        eq(publicFaqs.status, 'draft'),
        eq(publicFaqs.revision, revision),
      ),
    )
    .returning({ id: publicFaqs.id })
  return row
}
