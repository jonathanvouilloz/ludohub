import { del, put } from '@vercel/blob'
import { env } from '$env/dynamic/private'
import {
  parseManagedPublicSitePath,
  publicSiteMediaPath,
  type AuthorizedMediaScope,
  type ManagedBlobPath,
  type SupportedMediaType,
} from './paths.js'

export type MediaPolicy = {
  maxBytes: number
  allowedTypes: readonly SupportedMediaType[]
}

export type StoredBlob = {
  url: string
  downloadUrl: string
  pathname: ManagedBlobPath
  contentType: SupportedMediaType
  size: number
}

export class MediaStorageError extends Error {}

function blobToken(): string {
  const token = env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new MediaStorageError('Stockage des médias non configuré.')
  return token
}

function hasBytes(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value)
}

function signatureMatches(type: SupportedMediaType, bytes: Uint8Array): boolean {
  switch (type) {
    case 'image/jpeg':
      return hasBytes(bytes, [0xff, 0xd8, 0xff])
    case 'image/png':
      return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/webp':
      return (
        hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
      )
    case 'application/pdf':
      return hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
  }
}

export async function validateMediaFile(
  file: File,
  policy: MediaPolicy,
): Promise<SupportedMediaType> {
  if (file.size === 0) throw new MediaStorageError('Le fichier est vide.')
  if (!Number.isSafeInteger(policy.maxBytes) || policy.maxBytes <= 0) {
    throw new MediaStorageError('Politique de taille invalide.')
  }
  if (file.size > policy.maxBytes) {
    throw new MediaStorageError(`Fichier trop lourd (${policy.maxBytes} octets maximum).`)
  }

  const declaredType = file.type as SupportedMediaType
  if (!policy.allowedTypes.includes(declaredType)) {
    throw new MediaStorageError('Type de fichier non autorisé.')
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!signatureMatches(declaredType, header)) {
    throw new MediaStorageError('Le contenu du fichier ne correspond pas à son type déclaré.')
  }
  return declaredType
}

export async function uploadPublicSiteMedia(input: {
  scope: AuthorizedMediaScope
  file: File
  policy: MediaPolicy
}): Promise<StoredBlob> {
  const contentType = await validateMediaFile(input.file, input.policy)
  const pathname = publicSiteMediaPath({
    scope: input.scope,
    mediaType: contentType,
  })
  const blob = await put(pathname, input.file, {
    access: 'public',
    contentType,
    token: blobToken(),
  })
  return {
    url: contentType === 'application/pdf' ? blob.downloadUrl : blob.url,
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname as ManagedBlobPath,
    contentType,
    size: input.file.size,
  }
}

export async function deletePublicSiteMedia(
  scope: AuthorizedMediaScope,
  pathname: string,
): Promise<void> {
  const parsed = parseManagedPublicSitePath(pathname)
  if (!parsed) {
    throw new MediaStorageError('Chemin de média non géré.')
  }
  if (
    parsed.ludoId !== scope.ludoId ||
    parsed.domain !== scope.domain ||
    parsed.entityId !== scope.entityId
  ) {
    throw new MediaStorageError('Ce média n’appartient pas au périmètre autorisé.')
  }
  await del(pathname, { token: blobToken() })
}
