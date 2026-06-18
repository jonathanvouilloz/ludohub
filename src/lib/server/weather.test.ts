import { describe, expect, it } from 'vitest'
import { mapWmoToCondition } from './weather.js'

describe('mapWmoToCondition', () => {
  it('ciel clair → beau', () => {
    expect(mapWmoToCondition(0)).toBe('beau')
    expect(mapWmoToCondition(1)).toBe('beau')
  })

  it('nuageux / couvert / brouillard → gris', () => {
    expect(mapWmoToCondition(2)).toBe('gris')
    expect(mapWmoToCondition(3)).toBe('gris')
    expect(mapWmoToCondition(45)).toBe('gris')
    expect(mapWmoToCondition(48)).toBe('gris')
  })

  it('bruine / pluie / averses → pluie', () => {
    expect(mapWmoToCondition(51)).toBe('pluie')
    expect(mapWmoToCondition(61)).toBe('pluie')
    expect(mapWmoToCondition(67)).toBe('pluie')
    expect(mapWmoToCondition(81)).toBe('pluie')
  })

  it('neige → neige', () => {
    expect(mapWmoToCondition(71)).toBe('neige')
    expect(mapWmoToCondition(77)).toBe('neige')
    expect(mapWmoToCondition(85)).toBe('neige')
    expect(mapWmoToCondition(86)).toBe('neige')
  })

  it('orage → pluie', () => {
    expect(mapWmoToCondition(95)).toBe('pluie')
    expect(mapWmoToCondition(99)).toBe('pluie')
  })
})
