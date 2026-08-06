import type { getFamilySubmissionRowForLudo } from './db/family-registrations.js'

type AwaitedFamilySubmission = NonNullable<
  Awaited<ReturnType<typeof getFamilySubmissionRowForLudo>>
>

/** Whitelist unique pour éviter qu'une colonne interne ajoutée ne sorte par accident. */
export function extensionFamilySubmissionDto(row: AwaitedFamilySubmission) {
  return {
    id: row.id,
    site: { slug: row.siteSlug, name: row.siteName },
    status: row.status,
    revision: row.revision,
    submittedAt: row.createdAt,
    processedAt: row.processedAt,
    responsible: {
      gender: row.gender,
      firstName: row.firstName,
      lastName: row.lastName,
      birthDate: row.birthDate,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      phone: row.phone,
      secondaryPhone: row.secondaryPhone,
      email: row.email,
    },
    consent: {
      fullName: row.consentFullName,
      acceptedOn: row.consentAcceptedOn,
      acceptedAt: row.consentAcceptedAt,
      label: row.consentLabelSnapshot,
      documents: row.consentDocumentsSnapshot,
    },
    membershipFee: {
      amountCents: row.annualFeeCents,
      currency: row.currency,
      allowedMethods: [row.allowsTwint ? 'twint' : null, row.allowsCash ? 'cash' : null].filter(
        (method): method is 'twint' | 'cash' => method !== null,
      ),
    },
    payment: { method: row.paymentMethod, recordedAt: row.paymentRecordedAt },
    members: row.members.map((member) => ({
      gender: member.gender,
      firstName: member.firstName,
      lastName: member.lastName,
      birthDate: member.birthDate,
      sortOrder: member.sortOrder,
    })),
  }
}
