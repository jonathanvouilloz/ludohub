import { describe, expect, it } from 'vitest'
import { normalizeSlug } from './slug.js'

describe('normalizeSlug', () => {
  it('met en minuscules', () => {
    expect(normalizeSlug('Paquis')).toBe('paquis')
  })

  it('retire les accents', () => {
    expect(normalizeSlug('Ludothèque des Pâquis')).toBe('ludotheque-des-paquis')
  })

  it('remplace espaces et caractères spéciaux par des tirets', () => {
    expect(normalizeSlug('Servette / Petit-Saconnex')).toBe('servette-petit-saconnex')
  })

  it('collapse les séparateurs multiples', () => {
    expect(normalizeSlug('a   b___c')).toBe('a-b-c')
  })

  it('trim les tirets en début et fin', () => {
    expect(normalizeSlug('  --Genève--  ')).toBe('geneve')
  })

  it('retourne une chaîne vide si aucun caractère valide', () => {
    expect(normalizeSlug('!!! ---')).toBe('')
  })
})
