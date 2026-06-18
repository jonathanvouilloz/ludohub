import { describe, expect, it } from 'vitest'
import { formatWeekRange, isoWeekKey } from './dates.js'

describe('isoWeekKey', () => {
  it('numérote la semaine ISO (jeudi détermine l’année)', () => {
    // 18 juin 2026 = jeudi, semaine ISO 25.
    expect(isoWeekKey('2026-06-18')).toBe('2026-W25')
    // 15 juin 2026 (lundi) et 21 juin (dimanche) = même semaine.
    expect(isoWeekKey('2026-06-15')).toBe('2026-W25')
    expect(isoWeekKey('2026-06-21')).toBe('2026-W25')
  })

  it('gère le passage d’année (1er janvier rattaché à la semaine de son jeudi)', () => {
    // 1er janvier 2027 = vendredi → semaine 53 de 2026 (ISO).
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53')
    // 4 janvier 2027 = lundi → semaine 1 de 2027.
    expect(isoWeekKey('2027-01-04')).toBe('2027-W01')
  })

  it('produit des clés triables', () => {
    expect(isoWeekKey('2026-01-05') < isoWeekKey('2026-06-18')).toBe(true)
  })
})

describe('formatWeekRange', () => {
  it('même mois : « 15 – 21 juin 2026 »', () => {
    expect(formatWeekRange('2026-06-18')).toBe('15 – 21 juin 2026')
  })

  it('à cheval sur deux mois : inclut les deux mois', () => {
    // Semaine du 29 juin (lundi) au 5 juillet 2026 (dimanche).
    const label = formatWeekRange('2026-07-01')
    expect(label).toContain('29')
    expect(label).toContain('juin')
    expect(label).toContain('juil')
    expect(label).toContain('2026')
  })
})
