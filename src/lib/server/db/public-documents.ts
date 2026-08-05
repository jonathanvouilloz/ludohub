import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicDocuments,
  publicDocumentSites,
  type PublicContentStatus,
  type PublicDocumentInsert,
} from '../schema.js'

const withRelations = {
  author: true,
  updatedBy: true,
  publishedBy: true,
  targets: { with: { site: true } },
} as const
export const listPublicDocumentRows = (ludoId: string) =>
  db.query.publicDocuments.findMany({
    where: eq(publicDocuments.ludoId, ludoId),
    with: withRelations,
    orderBy: [desc(publicDocuments.createdAt), asc(publicDocuments.id)],
  })
export const getPublicDocumentRowForLudo = (id: string, ludoId: string) =>
  db.query.publicDocuments.findFirst({
    where: and(eq(publicDocuments.id, id), eq(publicDocuments.ludoId, ludoId)),
    with: withRelations,
  })
export const getPublishedPublicDocumentBySlug = (ludoId: string, slug: string) =>
  db.query.publicDocuments.findFirst({
    where: and(
      eq(publicDocuments.ludoId, ludoId),
      eq(publicDocuments.slug, slug),
      eq(publicDocuments.status, 'published'),
    ),
    columns: {
      id: true,
      ludoId: true,
      slug: true,
      kind: true,
      title: true,
      summary: true,
      bodyMarkdown: true,
      year: true,
      pdfUrl: true,
      pdfFileName: true,
      publishedAt: true,
    },
    with: { targets: { columns: { ludoId: true, siteId: true }, with: { site: true } } },
  })

export function listVisiblePublicDocumentSummaryRows(
  ludoId: string,
  siteId: string | undefined,
  limit: number,
) {
  const requested = siteId ? sql`AND active.id=${siteId}::uuid` : sql``
  return db
    .select({
      id: publicDocuments.id,
      ludoId: publicDocuments.ludoId,
      slug: publicDocuments.slug,
      kind: publicDocuments.kind,
      title: publicDocuments.title,
      summary: publicDocuments.summary,
      year: publicDocuments.year,
      pdfUrl: publicDocuments.pdfUrl,
      pdfFileName: publicDocuments.pdfFileName,
      publishedAt: publicDocuments.publishedAt,
    })
    .from(publicDocuments)
    .where(
      and(
        eq(publicDocuments.ludoId, ludoId),
        eq(publicDocuments.status, 'published'),
        sql`EXISTS (SELECT 1 FROM ludo_sites active WHERE active.ludo_id=${publicDocuments.ludoId} AND active.is_active=true ${requested} AND (NOT EXISTS (SELECT 1 FROM public_document_sites x WHERE x.document_id=${publicDocuments.id} AND x.ludo_id=${publicDocuments.ludoId}) OR EXISTS (SELECT 1 FROM public_document_sites x WHERE x.document_id=${publicDocuments.id} AND x.ludo_id=${publicDocuments.ludoId} AND x.site_id=active.id)))`,
      ),
    )
    .orderBy(desc(publicDocuments.year), desc(publicDocuments.publishedAt), asc(publicDocuments.id))
    .limit(limit)
}

export async function insertPublicDocumentAtomic(
  data: PublicDocumentInsert & { id: string },
  siteIds: string[],
) {
  const parent = db.insert(publicDocuments).values(data)
  if (!siteIds.length) await parent
  else
    await db.batch([
      parent,
      db
        .insert(publicDocumentSites)
        .values(siteIds.map((siteId) => ({ documentId: data.id, ludoId: data.ludoId, siteId }))),
    ])
  return getPublicDocumentRowForLudo(data.id, data.ludoId)
}

export async function updatePublicDocumentAtomic(
  id: string,
  ludoId: string,
  expectedRevision: number,
  data: Pick<
    PublicDocumentInsert,
    | 'slug'
    | 'kind'
    | 'title'
    | 'summary'
    | 'bodyMarkdown'
    | 'year'
    | 'pdfUrl'
    | 'pdfStorageKey'
    | 'pdfFileName'
    | 'updatedByMemberId'
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
    sql`WITH desired(site_id) AS (${desired}), updated AS (UPDATE public_documents SET slug=${data.slug},kind=${data.kind},title=${data.title},summary=${data.summary},body_markdown=${data.bodyMarkdown},year=${data.year},pdf_url=${data.pdfUrl},pdf_storage_key=${data.pdfStorageKey},pdf_file_name=${data.pdfFileName},updated_by_member_id=${data.updatedByMemberId}::uuid,updated_at=${data.updatedAt},revision=revision+1 WHERE id=${id}::uuid AND ludo_id=${ludoId}::uuid AND revision=${expectedRevision} RETURNING id,ludo_id), deleted AS (DELETE FROM public_document_sites x USING updated WHERE x.document_id=updated.id AND x.ludo_id=updated.ludo_id AND NOT EXISTS(SELECT 1 FROM desired WHERE desired.site_id=x.site_id)), inserted AS (INSERT INTO public_document_sites(document_id,ludo_id,site_id) SELECT updated.id,updated.ludo_id,desired.site_id FROM updated CROSS JOIN desired ON CONFLICT(document_id,site_id) DO NOTHING) SELECT id FROM updated`,
  )
  if (!result.rows.length) return undefined
  return getPublicDocumentRowForLudo(id, ludoId)
}

export async function updatePublicDocumentPublicationRow(
  id: string,
  ludoId: string,
  status: PublicContentStatus,
  revision: number,
  data: Pick<
    PublicDocumentInsert,
    'status' | 'publishedAt' | 'publishedByMemberId' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(publicDocuments)
    .set({ ...data, revision: sql`${publicDocuments.revision}+1` })
    .where(
      and(
        eq(publicDocuments.id, id),
        eq(publicDocuments.ludoId, ludoId),
        eq(publicDocuments.status, status),
        eq(publicDocuments.revision, revision),
      ),
    )
    .returning()
  return row
}
export async function updatePublicDocumentPdfRow(
  id: string,
  ludoId: string,
  revision: number,
  data: Pick<
    PublicDocumentInsert,
    'pdfUrl' | 'pdfStorageKey' | 'pdfFileName' | 'updatedByMemberId' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(publicDocuments)
    .set({ ...data, revision: sql`${publicDocuments.revision}+1` })
    .where(
      and(
        eq(publicDocuments.id, id),
        eq(publicDocuments.ludoId, ludoId),
        eq(publicDocuments.revision, revision),
      ),
    )
    .returning()
  return row
}
export async function deleteDraftPublicDocumentRow(id: string, ludoId: string, revision: number) {
  const [row] = await db
    .delete(publicDocuments)
    .where(
      and(
        eq(publicDocuments.id, id),
        eq(publicDocuments.ludoId, ludoId),
        eq(publicDocuments.status, 'draft'),
        eq(publicDocuments.revision, revision),
      ),
    )
    .returning({ id: publicDocuments.id, pdfStorageKey: publicDocuments.pdfStorageKey })
  return row
}
