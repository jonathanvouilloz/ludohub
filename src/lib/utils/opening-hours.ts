export type OpeningHourInput = {
  dayOfWeek: number
  opensAt: string
  closesAt: string
}

/** Erreur de saisie sûre à afficher dans une réponse de formulaire. */
export class OpeningHoursValidationError extends Error {}

export const WEEK_DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
] as const

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function minutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number)
  return hours * 60 + mins
}

/** Valide et trie les horaires hebdomadaires. Les plages qui se touchent sont permises. */
export function normalizeOpeningHours(value: unknown): OpeningHourInput[] {
  if (!Array.isArray(value)) {
    throw new OpeningHoursValidationError("Le format des horaires n'est pas valide.")
  }

  const hours = value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new OpeningHoursValidationError('Une plage horaire est invalide.')
    }
    const row = item as Record<string, unknown>
    const dayOfWeek = Number(row.dayOfWeek)
    const opensAt = String(row.opensAt ?? '')
    const closesAt = String(row.closesAt ?? '')

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new OpeningHoursValidationError('Le jour choisi est invalide.')
    }
    if (!TIME_PATTERN.test(opensAt) || !TIME_PATTERN.test(closesAt)) {
      throw new OpeningHoursValidationError("L'heure doit être au format HH:mm.")
    }
    if (minutes(opensAt) >= minutes(closesAt)) {
      throw new OpeningHoursValidationError("L'heure de fermeture doit suivre l'heure d'ouverture.")
    }
    return { dayOfWeek, opensAt, closesAt }
  })

  hours.sort((a, b) => a.dayOfWeek - b.dayOfWeek || minutes(a.opensAt) - minutes(b.opensAt))

  for (let index = 1; index < hours.length; index += 1) {
    const previous = hours[index - 1]
    const current = hours[index]
    if (
      previous.dayOfWeek === current.dayOfWeek &&
      minutes(current.opensAt) < minutes(previous.closesAt)
    ) {
      const day = WEEK_DAYS.find((entry) => entry.value === current.dayOfWeek)?.label
      throw new OpeningHoursValidationError(
        `Les plages du ${day?.toLowerCase() ?? 'jour'} se chevauchent.`,
      )
    }
  }

  return hours
}

export function parseOpeningHours(value: FormDataEntryValue | null): OpeningHourInput[] {
  if (typeof value !== 'string') {
    throw new OpeningHoursValidationError("Le format des horaires n'est pas valide.")
  }
  try {
    return normalizeOpeningHours(JSON.parse(value))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new OpeningHoursValidationError("Le format des horaires n'est pas valide.", {
        cause: error,
      })
    }
    throw error
  }
}

export function formatTime(value: string): string {
  return value.replace(':', 'h')
}
