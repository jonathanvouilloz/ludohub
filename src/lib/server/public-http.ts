import { env } from '$env/dynamic/private'

/** TTL court : une désactivation éditoriale ou du module ne doit jamais servir un stale prolongé. */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=30, s-maxage=60, must-revalidate'

function configuredOrigins(): Set<string> {
  return new Set(
    (env.PUBLIC_API_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
}

/** Les appels serveur-à-serveur n'ont généralement pas d'en-tête Origin et restent autorisés. */
export function publicCorsHeaders(request: Request): Headers | null {
  const origin = request.headers.get('origin')
  if (!origin) return new Headers({ Vary: 'Origin' })
  if (!configuredOrigins().has(origin)) return null

  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  })
}
