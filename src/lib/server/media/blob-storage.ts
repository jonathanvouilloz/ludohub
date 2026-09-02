import { del, put } from '@vercel/blob'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { env as publicEnv } from '$env/dynamic/public'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
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

const LOCAL_MEDIA_ROOT = resolve('static')

function localMediaUrl(pathname: ManagedBlobPath): string {
  const baseUrl = (publicEnv.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '')
  return `${baseUrl}/${pathname}`
}

function localMediaFile(pathname: ManagedBlobPath): string {
  return resolve(LOCAL_MEDIA_ROOT, ...pathname.split('/'))
}

function storageFailure(
  operation: 'enregistrement' | 'suppression',
  error: unknown,
): MediaStorageError {
  const detail = error instanceof Error ? error.message : String(error)
  return new MediaStorageError(
    `Le stockage des médias a échoué pendant l’${operation}. Vérifiez la configuration BLOB_READ_WRITE_TOKEN. (${detail})`,
  )
}

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
  if (dev) {
    const destination = localMediaFile(pathname)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, new Uint8Array(await input.file.arrayBuffer()))
    const url = localMediaUrl(pathname)
    return {
      url,
      downloadUrl: url,
      pathname,
      contentType,
      size: input.file.size,
    }
  }

  let blob
  try {
    blob = await put(pathname, input.file, {
      access: 'public',
      contentType,
      token: blobToken(),
    })
  } catch (error) {
    if (error instanceof MediaStorageError) throw error
    throw storageFailure('enregistrement', error)
  }
  return {
    // `url` ouvre le fichier dans le navigateur ; `downloadUrl` force le téléchargement.
    url: blob.url,
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
  if (dev) {
    try {
      await unlink(localMediaFile(pathname as ManagedBlobPath))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw storageFailure('suppression', error)
    }
    return
  }
  try {
    await del(pathname, { token: blobToken() })
  } catch (error) {
    if (error instanceof MediaStorageError) throw error
    throw storageFailure('suppression', error)
  }
}
