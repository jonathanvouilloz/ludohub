/**
 * Rate limiter fenêtre fixe, en mémoire process.
 *
 * Limite : l'état n'est pas partagé entre instances serverless. Avec Fluid
 * Compute (instances réutilisées), il freine efficacement les rafales depuis une
 * même source, mais ne garantit pas une limite globale multi-instances. Pour une
 * garantie stricte, adosser à Vercel KV / Upstash (même interface `check`).
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitResult = { ok: boolean; retryAfter: number }

/**
 * Incrémente le compteur de `key` et indique si la requête passe.
 * @param limit  nombre d'essais autorisés par fenêtre
 * @param windowMs durée de la fenêtre en millisecondes
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    pruneIfNeeded(now)
    return { ok: true, retryAfter: 0 }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

/** Purge opportuniste des fenêtres expirées (évite la croissance non bornée de la Map). */
function pruneIfNeeded(now: number): void {
  if (buckets.size < 5000) return
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}
