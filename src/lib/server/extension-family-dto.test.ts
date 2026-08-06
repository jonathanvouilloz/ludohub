import { describe, expect, it } from 'vitest'
import { extensionFamilySubmissionDto } from './extension-family-dto.js'

describe('contrat DTO adhésion extension', () => {
  it('reste imbriqué, versionné et exclut les champs internes', () => {
    const submittedAt = new Date('2026-08-06T10:00:00Z')
    const dto = extensionFamilySubmissionDto({
      id: 'submission',
      siteId: 'site',
      siteSlug: 'centre',
      siteName: 'Centre',
      formVersionId: 'version',
      annualFeeCents: 3000,
      currency: 'CHF',
      allowsTwint: true,
      allowsCash: false,
      gender: 'female',
      firstName: 'Ada',
      lastName: 'Lovelace',
      birthDate: null,
      address: 'Rue 1',
      postalCode: '1200',
      city: 'Genève',
      phone: '022',
      secondaryPhone: null,
      email: 'ada@example.test',
      consentFullName: 'Ada Lovelace',
      consentAcceptedOn: '2026-08-06',
      consentAcceptedAt: submittedAt,
      consentLabelSnapshot: 'J’accepte',
      consentDocumentsSnapshot: [{ version: 2, sha256: 'a'.repeat(64) }],
      status: 'new',
      paymentMethod: null,
      paymentRecordedAt: null,
      revision: 1,
      processedAt: null,
      purgeAt: null,
      createdAt: submittedAt,
      members: [
        {
          id: 'member',
          gender: 'male',
          firstName: 'Charles',
          lastName: 'Lovelace',
          birthDate: null,
          sortOrder: 0,
        },
      ],
    } as never)
    expect(dto).toEqual({
      id: 'submission',
      site: { slug: 'centre', name: 'Centre' },
      submittedAt,
      status: 'new',
      revision: 1,
      processedAt: null,
      responsible: {
        gender: 'female',
        firstName: 'Ada',
        lastName: 'Lovelace',
        birthDate: null,
        address: 'Rue 1',
        postalCode: '1200',
        city: 'Genève',
        phone: '022',
        secondaryPhone: null,
        email: 'ada@example.test',
      },
      consent: {
        fullName: 'Ada Lovelace',
        acceptedOn: '2026-08-06',
        acceptedAt: submittedAt,
        label: 'J’accepte',
        documents: [{ version: 2, sha256: 'a'.repeat(64) }],
      },
      membershipFee: { amountCents: 3000, currency: 'CHF', allowedMethods: ['twint'] },
      payment: { method: null, recordedAt: null },
      members: [
        {
          gender: 'male',
          firstName: 'Charles',
          lastName: 'Lovelace',
          birthDate: null,
          sortOrder: 0,
        },
      ],
    })
    expect(dto).not.toHaveProperty('purgeAt')
    expect(dto).not.toHaveProperty('siteId')
    expect(dto).not.toHaveProperty('formVersionId')
    expect(dto.members[0]).not.toHaveProperty('id')
    expect(dto).not.toHaveProperty('paymentRecordedByMemberId')
  })
})
