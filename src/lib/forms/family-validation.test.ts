import { describe, expect, it } from 'vitest'
import {
  buildFamilyPayload,
  familyFields,
  familyPayloadWithinLimit,
  validateFamilyForm,
} from './family-validation.js'

const values = {
  gender: 'female',
  firstName: 'Camille',
  lastName: 'Martin',
  address: 'Rue 1',
  postalCode: '1201',
  city: 'Genève',
  phone: '079 000 00 00',
  secondaryPhone: '',
  email: 'CAMILLE@example.ch',
  consentFullName: 'Camille Martin',
  consentAccepted: true,
}
describe('validation avant l’adhésion', () => {
  it('accepte le responsable seul et un téléphone secondaire vide', () => {
    expect(validateFamilyForm(values, [], ['one'])).toEqual({})
    expect(validateFamilyForm({ ...values, secondaryPhone: '   ' }, [], ['one'])).toEqual({})
  })
  it('conserve les codes postaux internationaux admis par le serveur', () => {
    expect(validateFamilyForm({ ...values, postalCode: 'SW1A 1AA' }, [], ['one'])).toEqual({})
  })
  it('explique tous les champs incomplets dès le départ', () => {
    const errors = validateFamilyForm({}, [], ['one', 'two'])
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        'gender',
        'firstName',
        'lastName',
        'address',
        'postalCode',
        'city',
        'phone',
        'email',
        'siteId',
        'consentAccepted',
        'consentFullName',
      ]),
    )
    expect(errors).not.toHaveProperty('secondaryPhone')
  })
  it('rejette chaque valeur requise blanche et chaque dépassement de longueur', () => {
    for (const field of familyFields) {
      if (!('optional' in field))
        expect(validateFamilyForm({ ...values, [field.name]: '   ' }, [], ['one'])).toHaveProperty(
          field.name,
        )
      expect(
        validateFamilyForm({ ...values, [field.name]: 'x'.repeat(field.max + 1) }, [], ['one']),
      ).toHaveProperty(field.name)
    }
  })
  it('respecte les règles suisses des téléphones et le regex e-mail partagé', () => {
    expect(
      validateFamilyForm(
        { ...values, phone: '+41 79 000 00 00', secondaryPhone: '0041.22.000.00.00' },
        [],
        ['one'],
      ),
    ).toEqual({})
    for (const phone of ['123', '+33 6 00 00 00 00', '079abc0000000'])
      expect(validateFamilyForm({ ...values, phone }, [], ['one'])).toHaveProperty('phone')
    for (const email of ['ada@', 'a.@example.ch', '.ada@example.ch', 'ada@localhost'])
      expect(validateFamilyForm({ ...values, email }, [], ['one'])).toHaveProperty('email')
  })
  it('valide les membres ajoutés, le lieu, le consentement et la signature', () => {
    const errors = validateFamilyForm(
      { ...values, siteId: 'unknown', consentAccepted: false, consentFullName: ' ' },
      [{ firstName: ' ', lastName: 'X' }],
      ['one', 'two'],
    )
    expect(errors).toHaveProperty('member-0-firstName')
    expect(errors).not.toHaveProperty('member-0-lastName')
    expect(errors).toHaveProperty('siteId')
    expect(errors).toHaveProperty('consentAccepted')
    expect(errors).toHaveProperty('consentFullName')
    expect(
      validateFamilyForm(
        { ...values, siteId: 'two' },
        [{ firstName: 'Alex', lastName: 'Martin' }],
        ['one', 'two'],
      ),
    ).toEqual({})
  })
  it('rejette les contrôles non imprimables', () => {
    expect(
      validateFamilyForm({ ...values, firstName: 'Camille\u0000' }, [], ['one']),
    ).toHaveProperty('firstName')
  })

  it('respecte la limite UTF-8 exacte du corps JSON', () => {
    expect(familyPayloadWithinLimit('x'.repeat(32_766))).toBe(true)
    expect(familyPayloadWithinLimit('x'.repeat(32_767))).toBe(false)
    expect(familyPayloadWithinLimit('遊'.repeat(10_922))).toBe(true)
    expect(familyPayloadWithinLimit('遊'.repeat(10_923))).toBe(false)
  })

  it('explique le dépassement global pour 50 membres multioctets valides', () => {
    const members = Array.from({ length: 50 }, () => ({
      firstName: '遊'.repeat(100),
      lastName: '遊'.repeat(100),
    }))
    const context = { consentAcceptedOn: '2026-10-12' }
    expect(validateFamilyForm(values, members, ['one'], context)).toEqual({})
    const largeValues = {
      ...values,
      address: '遊'.repeat(300),
      city: '遊'.repeat(120),
      consentFullName: '遊'.repeat(200),
      firstName: '遊'.repeat(100),
      lastName: '遊'.repeat(100),
    }
    expect(validateFamilyForm(largeValues, members, ['one'], context)).toEqual({
      transport: expect.any(String),
    })
    expect(
      familyPayloadWithinLimit(buildFamilyPayload(largeValues, members, context.consentAcceptedOn)),
    ).toBe(false)
    expect(validateFamilyForm(largeValues, members.slice(0, 40), ['one'], context)).toEqual({})
  })

  it('construit un corps normalisé incluant consentement, date et membres', () => {
    expect(
      buildFamilyPayload(
        {
          ...values,
          firstName: ' Camille ',
          secondaryPhone: ' ',
          siteId: ' one ',
          email: ' CAMILLE@EXAMPLE.CH ',
        },
        [{ firstName: ' Alex ', lastName: ' Martin ' }],
        '2026-10-12',
      ),
    ).toMatchObject({
      firstName: 'Camille',
      secondaryPhone: '',
      siteId: 'one',
      email: 'camille@example.ch',
      consentAccepted: true,
      consentAcceptedOn: '2026-10-12',
      members: [{ firstName: 'Alex', lastName: 'Martin' }],
    })
  })
})
