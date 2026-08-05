import { describe, expect, it, vi } from 'vitest'
import { checkRateLimit, MAX_RATE_LIMIT_BUCKETS } from './rate-limit.js'

describe('rate limiter en mémoire', () => {
  it('garde un plafond dur et évince déterministiquement la plus ancienne clé', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    for (let i = 0; i < MAX_RATE_LIMIT_BUCKETS; i += 1) {
      expect(checkRateLimit(`capacity-${i}`, 1, 60_000).ok).toBe(true)
    }
    expect(checkRateLimit('capacity-overflow', 1, 60_000).ok).toBe(true)

    // La première clé a été évincée et repart donc avec un compteur neuf.
    expect(checkRateLimit('capacity-0', 1, 60_000).ok).toBe(true)
  })
})
