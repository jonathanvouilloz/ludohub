import { describe, expect, it } from 'vitest'
import { parseZurichDateTimeLocal } from '$lib/server/zurich-datetime.js'
import { formatZurichDateTimeLocal } from './zurich-wall-clock.js'

describe('formatZurichDateTimeLocal', () => {
  it('formate un instant hivernal en heure murale UTC+1', () => {
    expect(formatZurichDateTimeLocal(new Date('2026-01-15T17:00:00.000Z'))).toBe('2026-01-15T18:00')
  })

  it('formate un instant estival en heure murale UTC+2', () => {
    expect(formatZurichDateTimeLocal('2026-07-15T16:00:00.000Z')).toBe('2026-07-15T18:00')
  })

  it.each(['2026-01-15T17:00:00.000Z', '2026-07-15T16:00:00.000Z'])(
    'conserve l’instant après un aller-retour pour %s',
    (instant) => {
      expect(parseZurichDateTimeLocal(formatZurichDateTimeLocal(instant)).toISOString()).toBe(
        instant,
      )
    },
  )
})
