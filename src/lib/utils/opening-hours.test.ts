import { describe, expect, it } from 'vitest'
import {
  normalizeOpeningHours,
  OpeningHoursValidationError,
  parseOpeningHours,
} from './opening-hours.js'

describe('normalizeOpeningHours', () => {
  it('trie les jours et les plages', () => {
    expect(
      normalizeOpeningHours([
        { dayOfWeek: 3, opensAt: '14:00', closesAt: '18:00' },
        { dayOfWeek: 1, opensAt: '09:00', closesAt: '12:00' },
        { dayOfWeek: 3, opensAt: '09:00', closesAt: '11:00' },
      ]),
    ).toEqual([
      { dayOfWeek: 1, opensAt: '09:00', closesAt: '12:00' },
      { dayOfWeek: 3, opensAt: '09:00', closesAt: '11:00' },
      { dayOfWeek: 3, opensAt: '14:00', closesAt: '18:00' },
    ])
  })

  it('accepte des plages consécutives', () => {
    expect(
      normalizeOpeningHours([
        { dayOfWeek: 2, opensAt: '09:00', closesAt: '12:00' },
        { dayOfWeek: 2, opensAt: '12:00', closesAt: '16:00' },
      ]),
    ).toHaveLength(2)
  })

  it('normalise les secondes ajoutées par les anciennes valeurs de base de données', () => {
    expect(
      normalizeOpeningHours([{ dayOfWeek: 1, opensAt: '09:30:00', closesAt: '11:45:00' }]),
    ).toEqual([{ dayOfWeek: 1, opensAt: '09:30', closesAt: '11:45' }])
  })

  it('refuse les horaires qui ne tombent pas sur un quart d’heure', () => {
    expect(() =>
      normalizeOpeningHours([{ dayOfWeek: 1, opensAt: '09:10', closesAt: '11:45' }]),
    ).toThrow('quarts d’heure')
  })

  it('refuse les chevauchements', () => {
    expect(() =>
      normalizeOpeningHours([
        { dayOfWeek: 5, opensAt: '09:00', closesAt: '12:30' },
        { dayOfWeek: 5, opensAt: '12:00', closesAt: '16:00' },
      ]),
    ).toThrow('vendredi se chevauchent')
  })

  it('refuse une fermeture avant l’ouverture', () => {
    expect(() =>
      normalizeOpeningHours([{ dayOfWeek: 1, opensAt: '18:00', closesAt: '09:00' }]),
    ).toThrow('fermeture doit suivre')
  })
})

describe('parseOpeningHours', () => {
  it('refuse un JSON invalide avec un message métier', () => {
    expect(() => parseOpeningHours('{')).toThrow(OpeningHoursValidationError)
    expect(() => parseOpeningHours('{')).toThrow('format des horaires')
  })
})
