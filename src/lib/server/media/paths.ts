import { randomUUID } from 'node:crypto'

export const PUBLIC_SITE_DOMAINS = [
  'announcements',
  'news',
  'activities',
  'top-games',
  'gallery',
  'profiles',
  'documents',
] as const

export type PublicSiteDomain = (typeof PUBLIC_SITE_DOMAINS)[number]
export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

/** Chemin construit par le serveur, jamais à partir d'un pathname fourni par le client. */
export type ManagedBlobPath = string & { readonly __managedBlobPath: unique symbol }
export type AuthorizedMediaScope = Readonly<{
  ludoId: string
  domain: PublicSiteDomain
  entityId: string
  readonly __authorizedMediaScope: unique symbol
}>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EXTENSIONS: Record<SupportedMediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export class MediaPathError extends Error {}

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) throw new MediaPathError(`${label} invalide.`)
  return value.toLowerCase()
}

export function extensionForMediaType(type: SupportedMediaType): string {
  return EXTENSIONS[type]
}

/** À appeler uniquement après que le service de domaine a validé tenant et permissions. */
export function createAuthorizedMediaScope(input: {
  ludoId: string
  domain: PublicSiteDomain
  entityId: string
}): AuthorizedMediaScope {
  if (!(PUBLIC_SITE_DOMAINS as readonly string[]).includes(input.domain)) {
    throw new MediaPathError('Domaine média invalide.')
  }
  return Object.freeze({
    ludoId: requireUuid(input.ludoId, 'Identifiant de ludothèque'),
    domain: input.domain,
    entityId: requireUuid(input.entityId, 'Identifiant de contenu'),
  }) as AuthorizedMediaScope
}

export function publicSiteMediaPath(input: {
  scope: AuthorizedMediaScope
  mediaType: SupportedMediaType
  blobId?: string
}): ManagedBlobPath {
  if (!(input.mediaType in EXTENSIONS)) throw new MediaPathError('Type de média invalide.')
  const blobId = requireUuid(input.blobId ?? randomUUID(), 'Identifiant de média')
  return `public-site/${input.scope.ludoId}/${input.scope.domain}/${input.scope.entityId}/${blobId}.${extensionForMediaType(input.mediaType)}` as ManagedBlobPath
}

export type ParsedPublicSiteMediaPath = Pick<AuthorizedMediaScope, 'ludoId' | 'domain' | 'entityId'>

export function parseManagedPublicSitePath(value: string): ParsedPublicSiteMediaPath | null {
  const parts = value.split('/')
  if (parts.length !== 5 || parts[0] !== 'public-site') return null
  const [ludoId, domain, entityId, filename] = parts.slice(1)
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return null
  const blobId = filename.slice(0, dot)
  const extension = filename.slice(dot + 1)
  if (
    !UUID_PATTERN.test(ludoId) ||
    !(PUBLIC_SITE_DOMAINS as readonly string[]).includes(domain) ||
    !UUID_PATTERN.test(entityId) ||
    !UUID_PATTERN.test(blobId) ||
    !Object.values(EXTENSIONS).includes(extension)
  ) {
    return null
  }
  return {
    ludoId: ludoId.toLowerCase(),
    domain: domain as PublicSiteDomain,
    entityId: entityId.toLowerCase(),
  }
}

export function isManagedPublicSitePath(value: string): value is ManagedBlobPath {
  return parseManagedPublicSitePath(value) != null
}
