const ZURICH_TIME_ZONE = 'Europe/Zurich'
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const POSSIBLE_UTC_OFFSETS_HOURS = [1, 2] as const

const zurichParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZURICH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export class ZurichDateTimeError extends Error {
  constructor(
    message: string,
    readonly reason: 'invalid' | 'nonexistent' | 'ambiguous',
  ) {
    super(message)
    this.name = 'ZurichDateTimeError'
  }
}

function partsAt(date: Date) {
  return Object.fromEntries(
    zurichParts
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

/** Parse a datetime-local wall-clock value in Europe/Zurich without DST guessing. */
export function parseZurichDateTimeLocal(value: string): Date {
  const match = LOCAL_DATE_TIME.exec(value)
  if (!match) throw new ZurichDateTimeError('Format de date et heure invalide.', 'invalid')

  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const expected = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: 0,
  }
  const utcWallClock = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
  )

  // Zurich only uses CET (UTC+1) and CEST (UTC+2). Formatting each candidate
  // back into the zone detects invalid calendar values, spring gaps and autumn overlaps.
  const candidates = POSSIBLE_UTC_OFFSETS_HOURS.map(
    (offset) => new Date(utcWallClock - offset * 60 * 60 * 1000),
  ).filter((candidate) => {
    const actual = partsAt(candidate)
    return Object.entries(expected).every(
      ([part, expectedValue]) => actual[part as keyof typeof actual] === expectedValue,
    )
  })

  if (candidates.length === 1) return candidates[0]
  if (candidates.length > 1) {
    throw new ZurichDateTimeError(
      'Cette heure est ambiguë à cause du changement d’heure.',
      'ambiguous',
    )
  }
  throw new ZurichDateTimeError(
    'Cette heure n’existe pas à cause du changement d’heure ou la date est invalide.',
    'nonexistent',
  )
}
