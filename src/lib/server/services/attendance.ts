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
import { getSiteByIdForLudo, listActiveSitesByLudo } from './sites.js'
import type { AttendancePeriod, AttendanceRow, LudoSiteRow, WeatherCondition } from '../schema.js'

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
  /** UUID du site (contrat courant). */
  siteId?: string | null
  /** Slug historique, accepté temporairement pour les anciens clients. */
  site?: string | null
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

/**
 * Résout et valide le site d'une séance selon la config multi-site de la ludo.
 * - Ludo mono-site (cas général) : on ignore toute valeur et on force `null`.
 * - Ludo multi-site (ex. Pâquis-Sécheron) : le site est **obligatoire** et doit
 *   appartenir à la liste configurée.
 */
async function resolveSite(
  ludoId: string,
  siteIdValue: string | null | undefined,
  legacySlugValue: string | null | undefined,
): Promise<{ siteId: string; site: string; includeLegacyNull: boolean }> {
  const sites = await listActiveSitesByLudo(ludoId)
  if (sites.length === 0) {
    throw new AttendanceServiceError('Aucun site actif n’est configuré pour cette ludothèque.')
  }

  // En mono-site, le site actif est toujours sélectionné côté serveur. Cela garde
  // les anciens formulaires (qui n'envoient pas de site_id) compatibles.
  if (sites.length === 1) {
    return { siteId: sites[0].id, site: sites[0].slug, includeLegacyNull: true }
  }

  const siteId = siteIdValue?.trim() || null
  const legacySlug = legacySlugValue?.trim() || null
  let selected: LudoSiteRow | undefined = siteId
    ? await getSiteByIdForLudo(siteId, ludoId)
    : undefined

  // Compatibilité avec l'ancienne app : son champ `site` contient encore le slug.
  // La nouvelle donnée persistée reste toujours l'UUID.
  if (!selected && !siteId && legacySlug) {
    selected = sites.find((candidate) => candidate.slug === legacySlug)
  }
  if (!selected || !selected.isActive) {
    const labels = sites.map((candidate) => candidate.name).join(' ou ')
    throw new AttendanceServiceError(`Choisissez le site (${labels}).`)
  }
  return { siteId: selected.id, site: selected.slug, includeLegacyNull: false }
}

type ResolvedSite = {
  siteId: string | null
  site: string | null
  includeLegacyNull: boolean
}

/**
 * En édition, une absence de choix signifie « conserver le rattachement actuel ».
 * C'est indispensable pour les séances historiques liées à un site désormais
 * désactivé : seules les nouvelles sélections sont validées contre les sites actifs.
 */
async function resolveSiteForUpdate(
  record: AttendanceRow,
  ludoId: string,
  input: SessionInput,
): Promise<ResolvedSite> {
  const hasExplicitChoice = Boolean(input.siteId?.trim() || input.site?.trim())
  if (!hasExplicitChoice) {
    const activeSites = await listActiveSitesByLudo(ludoId)
    const currentIsOnlyActiveSite =
      activeSites.length === 1 &&
      (activeSites[0].id === record.siteId ||
        (!record.siteId && activeSites[0].slug === record.site))
    return {
      siteId: record.siteId,
      site: record.site,
      includeLegacyNull: record.site == null || currentIsOnlyActiveSite,
    }
  }
  return resolveSite(ludoId, input.siteId, input.site)
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
  const selectedSite = await resolveSite(ludoId, input.siteId, input.site)
  const { includeLegacyNull, ...siteFields } = selectedSite
  if (
    fields.period !== 'evenement' &&
    (await existsForSlot(
      ludoId,
      fields.date,
      fields.period,
      selectedSite.siteId,
      selectedSite.site,
      includeLegacyNull,
    ))
  ) {
    throw new AttendanceServiceError(
      'Une séance est déjà clôturée pour cette date et cette période.',
    )
  }
  const resolved = await resolveEventType(ludoId, fields)
  return insertRecord({
    ludoId,
    closedByMemberId: memberId,
    ...siteFields,
    ...fields,
    ...resolved,
  })
}

/** Corrige une séance existante (compteurs, météo, date, période…). */
export async function updateSession(
  recordId: string,
  ludoId: string,
  input: SessionInput,
): Promise<AttendanceRow> {
  const record = await requireRecordInLudo(recordId, ludoId)
  const fields = normalize(input)
  const selectedSite = await resolveSiteForUpdate(record, ludoId, input)
  const { includeLegacyNull, ...siteFields } = selectedSite
  if (
    fields.period !== 'evenement' &&
    (await existsForSlot(
      ludoId,
      fields.date,
      fields.period,
      selectedSite.siteId,
      selectedSite.site,
      includeLegacyNull,
      recordId,
    ))
  ) {
    throw new AttendanceServiceError(
      'Une séance est déjà clôturée pour cette date et cette période.',
    )
  }
  const resolved = await resolveEventType(ludoId, fields)
  return updateRecord(recordId, { ...fields, ...resolved, ...siteFields })
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
