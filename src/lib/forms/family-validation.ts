/** Browser-safe rules mirrored by the mandatory family submission service. */
export const FAMILY_EMAIL =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,})+$/i
export const isSwissPhone = (value: string) =>
  /^(?:\+41|0041|0)[1-9]\d{8}$/.test(value.replace(/[\s.-]/g, ''))
export const FAMILY_MAX_BODY_BYTES = 32_768
export const familyPayloadWithinLimit = (payload: unknown) =>
  new TextEncoder().encode(JSON.stringify(payload)).byteLength <= FAMILY_MAX_BODY_BYTES

export function buildFamilyPayload(
  values: Record<string, string | boolean>,
  members: Array<{ firstName: string; lastName: string }>,
  consentAcceptedOn: string,
  website = '',
) {
  const clean = (name: string) =>
    String(values[name] ?? '')
      .replace(/\r\n?/g, '\n')
      .trim()
  return {
    ...Object.fromEntries(
      [...familyFields.map((field) => field.name), 'gender', 'consentFullName'].map((name) => [
        name,
        clean(name),
      ]),
    ),
    ...(clean('siteId') ? { siteId: clean('siteId') } : {}),
    email: clean('email').toLowerCase(),
    consentAccepted: values.consentAccepted === true,
    consentAcceptedOn,
    website: website.replace(/\r\n?/g, '\n').trim(),
    members: members.map((member) => ({
      firstName: member.firstName.replace(/\r\n?/g, '\n').trim(),
      lastName: member.lastName.replace(/\r\n?/g, '\n').trim(),
    })),
  }
}
export const familyFields = [
  {
    name: 'firstName',
    label: 'Prénom',
    max: 100,
    autocomplete: 'given-name',
    placeholder: 'Camille',
    hint: 'Votre prénom, 100 caractères maximum.',
  },
  {
    name: 'lastName',
    label: 'Nom',
    max: 100,
    autocomplete: 'family-name',
    placeholder: 'Martin',
    hint: 'Votre nom, 100 caractères maximum.',
  },
  {
    name: 'address',
    label: 'Adresse',
    max: 300,
    autocomplete: 'street-address',
    placeholder: 'Rue de Berne 50',
    hint: 'Rue et numéro, 300 caractères maximum.',
    full: true,
  },
  {
    name: 'postalCode',
    label: 'NPA / code postal',
    max: 20,
    autocomplete: 'postal-code',
    placeholder: '1201',
    hint: 'Votre code postal, 20 caractères maximum.',
  },
  {
    name: 'city',
    label: 'Ville',
    max: 120,
    autocomplete: 'address-level2',
    placeholder: 'Genève',
    hint: 'Votre ville, 120 caractères maximum.',
  },
  {
    name: 'phone',
    label: 'Téléphone',
    max: 50,
    autocomplete: 'tel',
    placeholder: '079 000 00 00',
    hint: 'Numéro suisse : 079 000 00 00 ou +41 79 000 00 00.',
    type: 'tel',
  },
  {
    name: 'secondaryPhone',
    label: 'Autre téléphone (facultatif)',
    max: 50,
    autocomplete: 'tel',
    placeholder: '022 000 00 00',
    hint: 'Laissez vide ou indiquez un autre numéro suisse.',
    type: 'tel',
    optional: true,
  },
  {
    name: 'email',
    label: 'E-mail',
    max: 320,
    autocomplete: 'email',
    placeholder: 'prenom@exemple.ch',
    hint: 'Adresse complète à laquelle nous pourrons vous répondre.',
    type: 'email',
    full: true,
  },
] as const

export function familyTextError(
  value: string,
  label: string,
  max: number,
  optional = false,
): string {
  const clean = value.replace(/\r\n?/g, '\n').trim()
  if (!clean) return optional ? '' : `${label} : renseignez ce champ.`
  if (clean.length > max) return `${label} : ${max} caractères maximum.`
  if ([...clean].some((c) => c.charCodeAt(0) < 32 && c !== '\n' && c !== '\t'))
    return `${label} : retirez les caractères non imprimables.`
  return ''
}

export function validateFamilyForm(
  values: Record<string, string | boolean>,
  members: Array<{ firstName: string; lastName: string }>,
  siteIds: string[],
  submissionContext?: { consentAcceptedOn: string; website?: string },
) {
  const errors: Record<string, string> = {}
  const text = (name: string) => String(values[name] ?? '')
  for (const field of familyFields) {
    const error = familyTextError(
      text(field.name),
      field.label,
      field.max,
      'optional' in field && field.optional,
    )
    if (error) errors[field.name] = error
  }
  for (const name of ['phone', 'secondaryPhone']) {
    if (!errors[name] && text(name).trim() && !isSwissPhone(text(name)))
      errors[name] =
        `${name === 'phone' ? 'Téléphone' : 'Autre téléphone'} : utilisez un numéro suisse, par exemple 079 000 00 00.`
  }
  if (!errors.email && !FAMILY_EMAIL.test(text('email').trim()))
    errors.email = 'E-mail : indiquez une adresse complète, par exemple prenom@exemple.ch.'
  if (!['female', 'male', 'other'].includes(text('gender')))
    errors.gender = 'Genre : choisissez une option.'
  if (siteIds.length !== 1 && !siteIds.includes(text('siteId')))
    errors.siteId = 'Lieu : choisissez votre ludothèque.'
  if (values.consentAccepted !== true)
    errors.consentAccepted = 'Confirmez votre accord avec le règlement et les conditions indiquées.'
  const signature = familyTextError(text('consentFullName'), 'Signature', 200)
  if (signature) errors.consentFullName = signature
  if (members.length > 50)
    errors.members = 'Retirez des membres : 50 personnes supplémentaires maximum.'
  members.forEach((member, index) => {
    for (const name of ['firstName', 'lastName'] as const) {
      const error = familyTextError(
        member[name],
        `Membre ${index + 1}, ${name === 'firstName' ? 'prénom' : 'nom'}`,
        100,
      )
      if (error) errors[`member-${index}-${name}`] = error
    }
  })
  if (
    submissionContext &&
    !familyPayloadWithinLimit(
      buildFamilyPayload(
        values,
        members,
        submissionContext.consentAcceptedOn,
        submissionContext.website,
      ),
    )
  )
    errors.transport =
      'Votre demande est trop volumineuse pour l’envoi. Raccourcissez les champs longs ou contactez directement la ludothèque pour inscrire tous les membres.'
  return errors
}
