const zurichDateTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Format an instant for a datetime-local input using Zurich wall-clock time. */
export function formatZurichDateTimeLocal(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date')

  const parts = Object.fromEntries(
    zurichDateTime
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
