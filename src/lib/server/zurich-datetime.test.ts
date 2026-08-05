import { describe, expect, it } from 'vitest'
import { parseZurichDateTimeLocal, ZurichDateTimeError } from './zurich-datetime.js'

describe('parseZurichDateTimeLocal', () => {
  it('convertit une heure murale d’hiver en UTC+1', () => {
    expect(parseZurichDateTimeLocal('2026-01-15T18:30').toISOString()).toBe(
      '2026-01-15T17:30:00.000Z',
    )
  })

  it('convertit une heure murale d’été en UTC+2', () => {
    expect(parseZurichDateTimeLocal('2026-07-15T18:30').toISOString()).toBe(
      '2026-07-15T16:30:00.000Z',
    )
  })

  it('rejette une heure inexistante dans le trou du passage à l’heure d’été', () => {
    expect(() => parseZurichDateTimeLocal('2026-03-29T02:30')).toThrowError(
      expect.objectContaining<Partial<ZurichDateTimeError>>({ reason: 'nonexistent' }),
    )
  })

  it('rejette une heure ambiguë lors du retour à l’heure d’hiver', () => {
    expect(() => parseZurichDateTimeLocal('2026-10-25T02:30')).toThrowError(
      expect.objectContaining<Partial<ZurichDateTimeError>>({ reason: 'ambiguous' }),
    )
  })

  it('rejette les formats permissifs et les dates calendaires impossibles', () => {
    expect(() => parseZurichDateTimeLocal('2026-01-15 18:30')).toThrowError(
      expect.objectContaining<Partial<ZurichDateTimeError>>({ reason: 'invalid' }),
    )
    expect(() => parseZurichDateTimeLocal('2026-02-30T18:30')).toThrowError(
      expect.objectContaining<Partial<ZurichDateTimeError>>({ reason: 'nonexistent' }),
    )
  })
})
