import { and, asc, eq } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicEditorialAssets,
  type PublicEditorialAssetInsert,
  type PublicEditorialAssetKind,
} from '../schema.js'

export type EditorialAssetOwner = { type: 'news'; id: string } | { type: 'activity'; id: string }

function ownerWhere(owner: EditorialAssetOwner) {
  return owner.type === 'news'
    ? eq(publicEditorialAssets.newsId, owner.id)
    : eq(publicEditorialAssets.activityId, owner.id)
}

export function listPublicEditorialAssetRows(ludoId: string, owner: EditorialAssetOwner) {
  return db.query.publicEditorialAssets.findMany({
    where: and(eq(publicEditorialAssets.ludoId, ludoId), ownerWhere(owner)),
    orderBy: [
      asc(publicEditorialAssets.kind),
      asc(publicEditorialAssets.sortOrder),
      asc(publicEditorialAssets.id),
    ],
  })
}

export function getPublicEditorialAssetRow(id: string, ludoId: string) {
  return db.query.publicEditorialAssets.findFirst({
    where: and(eq(publicEditorialAssets.id, id), eq(publicEditorialAssets.ludoId, ludoId)),
  })
}

export async function insertPublicEditorialAssetRow(data: PublicEditorialAssetInsert) {
  const [row] = await db.insert(publicEditorialAssets).values(data).returning()
  return row
}

export async function updatePublicEditorialAssetRow(
  id: string,
  ludoId: string,
  data: Pick<
    PublicEditorialAssetInsert,
    | 'url'
    | 'downloadUrl'
    | 'storageKey'
    | 'mimeType'
    | 'fileName'
    | 'sizeBytes'
    | 'alt'
    | 'caption'
    | 'credit'
    | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(publicEditorialAssets)
    .set(data)
    .where(and(eq(publicEditorialAssets.id, id), eq(publicEditorialAssets.ludoId, ludoId)))
    .returning()
  return row
}

export async function deletePublicEditorialAssetRow(id: string, ludoId: string) {
  const [row] = await db
    .delete(publicEditorialAssets)
    .where(and(eq(publicEditorialAssets.id, id), eq(publicEditorialAssets.ludoId, ludoId)))
    .returning()
  return row
}

export async function countPublicEditorialAssets(
  ludoId: string,
  owner: EditorialAssetOwner,
  kind: PublicEditorialAssetKind,
) {
  const rows = await listPublicEditorialAssetRows(ludoId, owner)
  return rows.filter((row) => row.kind === kind).length
}
