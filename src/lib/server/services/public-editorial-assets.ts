import { randomUUID } from 'node:crypto'
import {
  deletePublicEditorialAssetRow,
  getPublicEditorialAssetRow,
  insertPublicEditorialAssetRow,
  listPublicEditorialAssetRows,
  updatePublicEditorialAssetRow,
  type EditorialAssetOwner,
} from '../db/public-editorial-assets.js'
import type { StoredBlob } from '../media/blob-storage.js'
import { parseManagedPublicSitePath, type AuthorizedMediaScope } from '../media/paths.js'

export class PublicEditorialAssetServiceError extends Error {}

export const MAX_PDF_ATTACHMENTS = 5
export const MAX_ACTIVITY_IMAGES = 5
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const PDF_MAX_BYTES = 15 * 1024 * 1024

function required(value: string, label: string, max: number) {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized || normalized.length > max) {
    throw new PublicEditorialAssetServiceError(
      `${label} doit contenir entre 1 et ${max} caractères.`,
    )
  }
  return normalized
}

function optional(value: string | null | undefined, label: string, max: number) {
  if (value == null || !value.trim()) return null
  return required(value, label, max)
}

function normalizedFileName(value: string) {
  const name = value.replace(/\\/g, '/').split('/').at(-1) ?? ''
  return required(name, 'Le nom du fichier', 300)
}

function ownerColumns(owner: EditorialAssetOwner) {
  return owner.type === 'news'
    ? { newsId: owner.id, activityId: null }
    : { newsId: null, activityId: owner.id }
}

function assertScope(
  scope: AuthorizedMediaScope,
  owner: EditorialAssetOwner,
  ludoId: string,
  pathname: string,
) {
  const expectedDomain = owner.type === 'news' ? 'news' : 'activities'
  const parsed = parseManagedPublicSitePath(pathname)
  if (
    scope.ludoId !== ludoId.toLowerCase() ||
    scope.domain !== expectedDomain ||
    scope.entityId !== owner.id.toLowerCase() ||
    !parsed ||
    parsed.ludoId !== scope.ludoId ||
    parsed.domain !== scope.domain ||
    parsed.entityId !== scope.entityId
  ) {
    throw new PublicEditorialAssetServiceError("Le média n'appartient pas à ce contenu.")
  }
}

function assertBlobSize(blob: StoredBlob, max: number, label: string) {
  if (!Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > max) {
    throw new PublicEditorialAssetServiceError(`${label} dépasse la taille autorisée.`)
  }
}

export function listPublicEditorialAssets(ludoId: string, owner: EditorialAssetOwner) {
  return listPublicEditorialAssetRows(ludoId, owner)
}

export async function upsertPublicSupportImage(input: {
  ludoId: string
  owner: EditorialAssetOwner
  memberId: string
  scope: AuthorizedMediaScope
  blob: StoredBlob
  alt: string
  caption?: string | null
  credit?: string | null
  now?: Date
}) {
  const now = input.now ?? new Date()
  assertScope(input.scope, input.owner, input.ludoId, input.blob.pathname)
  if (!IMAGE_TYPES.has(input.blob.contentType)) {
    throw new PublicEditorialAssetServiceError("L'image d'appoint doit être un JPEG, PNG ou WebP.")
  }
  assertBlobSize(input.blob, IMAGE_MAX_BYTES, "L'image")
  const values = {
    url: required(input.blob.url, "L'URL de l'image", 2000),
    downloadUrl: null,
    storageKey: input.blob.pathname,
    mimeType: input.blob.contentType,
    fileName: null,
    sizeBytes: input.blob.size,
    alt: required(input.alt, 'Le texte alternatif', 300),
    caption: optional(input.caption, 'La légende', 500),
    credit: optional(input.credit, 'Le crédit', 200),
    updatedAt: now,
  }
  const existing = (await listPublicEditorialAssetRows(input.ludoId, input.owner)).find(
    (asset) => asset.kind === 'support_image',
  )
  if (existing) {
    const asset = await updatePublicEditorialAssetRow(existing.id, input.ludoId, values)
    if (!asset) throw new PublicEditorialAssetServiceError("L'image d'appoint est introuvable.")
    return { asset, previousStorageKey: existing.storageKey }
  }
  const asset = await insertPublicEditorialAssetRow({
    id: randomUUID(),
    ludoId: input.ludoId,
    ...ownerColumns(input.owner),
    kind: 'support_image',
    ...values,
    sortOrder: 0,
    createdByMemberId: input.memberId,
    createdAt: now,
  })
  return { asset, previousStorageKey: null }
}

/** Ajoute une image au contenu d'une activité, dans l'ordre de sélection. */
export async function addPublicActivitySupportImage(input: {
  ludoId: string
  owner: Extract<EditorialAssetOwner, { type: 'activity' }>
  memberId: string
  scope: AuthorizedMediaScope
  blob: StoredBlob
  alt: string
  caption?: string | null
  credit?: string | null
  now?: Date
}) {
  const now = input.now ?? new Date()
  assertScope(input.scope, input.owner, input.ludoId, input.blob.pathname)
  if (!IMAGE_TYPES.has(input.blob.contentType)) {
    throw new PublicEditorialAssetServiceError("L'image de l'activité doit être un JPEG, PNG ou WebP.")
  }
  assertBlobSize(input.blob, IMAGE_MAX_BYTES, "L'image")
  const images = (await listPublicEditorialAssetRows(input.ludoId, input.owner)).filter(
    (asset) => asset.kind === 'support_image',
  )
  if (images.length >= MAX_ACTIVITY_IMAGES) {
    throw new PublicEditorialAssetServiceError(
      `Maximum ${MAX_ACTIVITY_IMAGES} images dans le contenu d'une activité.`,
    )
  }
  return insertPublicEditorialAssetRow({
    id: randomUUID(),
    ludoId: input.ludoId,
    ...ownerColumns(input.owner),
    kind: 'support_image',
    url: required(input.blob.url, "L'URL de l'image", 2000),
    downloadUrl: null,
    storageKey: input.blob.pathname,
    mimeType: input.blob.contentType,
    fileName: null,
    sizeBytes: input.blob.size,
    alt: required(input.alt, 'Le texte alternatif', 300),
    caption: optional(input.caption, 'La légende', 500),
    credit: optional(input.credit, 'Le crédit', 200),
    sortOrder: images.length,
    createdByMemberId: input.memberId,
    createdAt: now,
    updatedAt: now,
  })
}

export async function addPublicPdfAttachment(input: {
  ludoId: string
  owner: EditorialAssetOwner
  memberId: string
  scope: AuthorizedMediaScope
  blob: StoredBlob
  title: string
  fileName: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  assertScope(input.scope, input.owner, input.ludoId, input.blob.pathname)
  if (input.blob.contentType !== 'application/pdf') {
    throw new PublicEditorialAssetServiceError('Seuls les PDF sont autorisés en pièce jointe.')
  }
  assertBlobSize(input.blob, PDF_MAX_BYTES, 'Le PDF')
  const assets = await listPublicEditorialAssetRows(input.ludoId, input.owner)
  const attachments = assets.filter((asset) => asset.kind === 'pdf_attachment')
  if (attachments.length >= MAX_PDF_ATTACHMENTS) {
    throw new PublicEditorialAssetServiceError(
      `Maximum ${MAX_PDF_ATTACHMENTS} PDF par publication.`,
    )
  }
  return insertPublicEditorialAssetRow({
    id: randomUUID(),
    ludoId: input.ludoId,
    ...ownerColumns(input.owner),
    kind: 'pdf_attachment',
    url: required(input.blob.url, "L'URL d'ouverture", 2000),
    downloadUrl: required(input.blob.downloadUrl, "L'URL de téléchargement", 2000),
    storageKey: input.blob.pathname,
    mimeType: 'application/pdf',
    fileName: normalizedFileName(input.fileName),
    sizeBytes: input.blob.size,
    alt: null,
    caption: required(input.title, 'Le titre du PDF', 500),
    credit: null,
    sortOrder: attachments.length,
    createdByMemberId: input.memberId,
    createdAt: now,
    updatedAt: now,
  })
}

function belongsToOwner(
  asset: NonNullable<Awaited<ReturnType<typeof getPublicEditorialAssetRow>>>,
  owner: EditorialAssetOwner,
) {
  return owner.type === 'news'
    ? asset.newsId === owner.id && asset.activityId === null
    : asset.activityId === owner.id && asset.newsId === null
}

export async function deletePublicEditorialAsset(
  id: string,
  ludoId: string,
  owner: EditorialAssetOwner,
) {
  const asset = await getPublicEditorialAssetRow(id, ludoId)
  if (!asset || !belongsToOwner(asset, owner)) {
    throw new PublicEditorialAssetServiceError('Média complémentaire introuvable.')
  }
  const deleted = await deletePublicEditorialAssetRow(id, ludoId)
  if (!deleted) throw new PublicEditorialAssetServiceError('Média complémentaire introuvable.')
  return deleted
}
