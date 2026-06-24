import {
  deleteRecord,
  existsForSlot,
  getRecordById,
  insertRecord,
  listByDateRange,
  listByMonth,
  updateRecord,
} from '../db/attendance.js'
import { getEventTypeById } from '../db/eventTypes.js'
import type { AttendancePeriod, AttendanceRow, WeatherCondition } from '../schema.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class AttendanceServiceError extends Error {}

const PERIODS = ['matin', 'apres_midi', 'evenement'] as const
const WEATHERS = ['beau', 'gris', 'pluie', 'neige'] as const

const COUNTER_LABELS = {
  adultsCount: "le nombre d'adultes",
  childrenCount: "le nombre d'enfants",
  loansCount: 'le nombre de prêts',
  returnsCount: 'le nombre de retours',
} as const

type CounterKey = keyof typeof COUNTER_LABELS

export type SessionInput = {
  date: string
  period: string
  eventLabel?: string | null
  eventTypeId?: string | null
  adultsCount: number
  childrenCount: number
  loansCount: number
  returnsCount: number
  weather?: string | null
  temperature?: number | null
}

function parsePeriod(value: string): AttendancePeriod {
  if (!(PERIODS as readonly string[]).includes(value)) {
    throw new AttendanceServiceError('Période invalide.')
  }
  return value as AttendancePeriod
}

function parseDate(value: string): string {
  const d = new Date(`${value}T12:00:00`)
  if (!value || Number.isNaN(d.getTime())) {
    throw new AttendanceServiceError('Date invalide.')
  }
  return value
}

function parseCount(value: number, key: CounterKey): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new AttendanceServiceError(`Valeur invalide pour ${COUNTER_LABELS[key]} (entier ≥ 0).`)
  }
  return value
}

function parseWeather(value: string | null | undefined): WeatherCondition | null {
  if (value == null || value === '') return null
  if (!(WEATHERS as readonly string[]).includes(value)) {
    throw new AttendanceServiceError('Condition météo invalide.')
  }
  return value as WeatherCondition
}

function parseTemperature(value: number | null | undefined): number | null {
  if (value == null) return null
  if (!Number.isInteger(value)) {
    throw new AttendanceServiceError('Température invalide (entier en °C).')
  }
  return value
}

/** Normalise + valide un input de séance (création ou édition). Pur/synchrone :
 * la résolution du type d'événement (snapshot + tenant) se fait à part, en async. */
function normalize(input: SessionInput) {
  const period = parsePeriod(input.period)
  const date = parseDate(input.date)
  const isEvent = period === 'evenement'
  const eventLabel = input.eventLabel?.trim() || null
  const eventTypeId = input.eventTypeId?.trim() || null
  if (isEvent && !eventTypeId && !eventLabel) {
    throw new AttendanceServiceError('Choisissez un type d’événement ou saisissez un libellé.')
  }
  return {
    date,
    period,
    eventLabel: isEvent ? eventLabel : null,
    eventTypeId: isEvent ? eventTypeId : null,
    adultsCount: parseCount(input.adultsCount, 'adultsCount'),
    childrenCount: parseCount(input.childrenCount, 'childrenCount'),
    loansCount: parseCount(input.loansCount, 'loansCount'),
    returnsCount: parseCount(input.returnsCount, 'returnsCount'),
    weather: parseWeather(input.weather),
    temperature: parseTemperature(input.temperature),
  }
}

/**
 * Résout le type d'événement choisi : vérifie qu'il appartient à la ludo et
 * **snapshote son nom dans `eventLabel`** pour que l'historique reste lisible si
 * le type est plus tard renommé ou supprimé. Si « Autre » (pas de type), on
 * conserve la saisie libre.
 */
async function resolveEventType(
  ludoId: string,
  fields: ReturnType<typeof normalize>,
): Promise<{ eventTypeId: string | null; eventLabel: string | null }> {
  if (fields.period !== 'evenement' || !fields.eventTypeId) {
    return { eventTypeId: fields.eventTypeId, eventLabel: fields.eventLabel }
  }
  const type = await getEventTypeById(fields.eventTypeId)
  if (!type || type.ludoId !== ludoId) {
    throw new AttendanceServiceError('Type d’événement invalide.')
  }
  return { eventTypeId: type.id, eventLabel: type.name }
}

/** Charge une séance et vérifie qu'elle appartient bien à la ludo. */
async function requireRecordInLudo(id: string, ludoId: string): Promise<AttendanceRow> {
  const record = await getRecordById(id)
  if (!record || record.ludoId !== ludoId) {
    throw new AttendanceServiceError('Séance introuvable.')
  }
  return record
}

/** Clôture une nouvelle séance. */
export async function recordSession(
  ludoId: string,
  memberId: string,
  input: SessionInput,
): Promise<AttendanceRow> {
  const fields = normalize(input)
  if (fields.period !== 'evenement' && (await existsForSlot(ludoId, fields.date, fields.period))) {
    throw new AttendanceServiceError(
      'Une séance est déjà clôturée pour cette date et cette période.',
    )
  }
  const resolved = await resolveEventType(ludoId, fields)
  return insertRecord({ ludoId, closedByMemberId: memberId, ...fields, ...resolved })
}

/** Corrige une séance existante (compteurs, météo, date, période…). */
export async function updateSession(
  recordId: string,
  ludoId: string,
  input: SessionInput,
): Promise<AttendanceRow> {
  await requireRecordInLudo(recordId, ludoId)
  const fields = normalize(input)
  if (
    fields.period !== 'evenement' &&
    (await existsForSlot(ludoId, fields.date, fields.period, recordId))
  ) {
    throw new AttendanceServiceError(
      'Une séance est déjà clôturée pour cette date et cette période.',
    )
  }
  const resolved = await resolveEventType(ludoId, fields)
  return updateRecord(recordId, { ...fields, ...resolved })
}

/** Supprime une séance (correction d'une saisie erronée). */
export async function deleteSession(recordId: string, ludoId: string): Promise<void> {
  await requireRecordInLudo(recordId, ludoId)
  await deleteRecord(recordId)
}

export type MonthTotals = {
  adultsCount: number
  childrenCount: number
  loansCount: number
  returnsCount: number
}

/** Séances clôturées sur une plage de dates (ex. toute une saison). */
export async function listSessionsInRange(ludoId: string, start: string, end: string) {
  return listByDateRange(ludoId, start, end)
}

/** Séances du mois + totaux agrégés (adultes/enfants/prêts/retours). */
export async function getMonthSummary(ludoId: string, year: number, month: number) {
  const records = await listByMonth(ludoId, year, month)
  const totals: MonthTotals = {
    adultsCount: 0,
    childrenCount: 0,
    loansCount: 0,
    returnsCount: 0,
  }
  for (const r of records) {
    totals.adultsCount += r.adultsCount
    totals.childrenCount += r.childrenCount
    totals.loansCount += r.loansCount
    totals.returnsCount += r.returnsCount
  }
  return { records, totals }
}
