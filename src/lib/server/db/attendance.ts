import { and, eq, gte, isNull, lte, or, type SQL } from 'drizzle-orm'
import { db } from './index.js'
import {
  attendanceRecords,
  type AttendanceInsert,
  type AttendancePeriod,
  type AttendanceRow,
} from '../schema.js'

/** Borne du mois [premier, dernier] en strings ISO `YYYY-MM-DD`. */
function monthBounds(year: number, month: number): { start: string; end: string } {
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

export async function insertRecord(data: AttendanceInsert): Promise<AttendanceRow> {
  const [record] = await db.insert(attendanceRecords).values(data).returning()
  return record
}

export async function updateRecord(
  id: string,
  data: Partial<
    Pick<
      AttendanceInsert,
      | 'date'
      | 'period'
      | 'eventLabel'
      | 'eventTypeId'
      | 'adultsCount'
      | 'childrenCount'
      | 'loansCount'
      | 'returnsCount'
      | 'weather'
      | 'temperature'
      | 'siteId'
      | 'site'
    >
  >,
): Promise<AttendanceRow> {
  const [updated] = await db
    .update(attendanceRecords)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(attendanceRecords.id, id))
    .returning()
  return updated
}

export async function deleteRecord(id: string): Promise<void> {
  await db.delete(attendanceRecords).where(eq(attendanceRecords.id, id))
}

export async function getRecordById(id: string): Promise<AttendanceRow | undefined> {
  return db.query.attendanceRecords.findFirst({ where: eq(attendanceRecords.id, id) })
}

/** Séances clôturées d'un mois donné, plus récentes en tête. */
export async function listByMonth(ludoId: string, year: number, month: number) {
  const { start, end } = monthBounds(year, month)
  return db.query.attendanceRecords.findMany({
    where: and(
      eq(attendanceRecords.ludoId, ludoId),
      gte(attendanceRecords.date, start),
      lte(attendanceRecords.date, end),
    ),
    with: { closedBy: true, siteRecord: true },
    orderBy: (a, { desc, asc }) => [desc(a.date), asc(a.period)],
  })
}

/** Séances clôturées sur une plage de dates ISO `[start, end]`, plus récentes en tête. */
export async function listByDateRange(ludoId: string, start: string, end: string) {
  return db.query.attendanceRecords.findMany({
    where: and(
      eq(attendanceRecords.ludoId, ludoId),
      gte(attendanceRecords.date, start),
      lte(attendanceRecords.date, end),
    ),
    with: { closedBy: true, siteRecord: true },
    orderBy: (a, { desc, asc }) => [desc(a.date), asc(a.period)],
  })
}

/**
 * Vrai si une séance existe déjà pour ce créneau (ludo, date, période, site).
 * À n'appeler que pour `matin`/`apres_midi` : la période `evenement` n'est pas
 * contrainte (plusieurs événements possibles le même jour). Le `site` discrimine
 * les ludos multi-sites (un créneau par site) ; `null` cible les séances non
 * réparties / les ludos mono-site.
 */
export async function existsForSlot(
  ludoId: string,
  date: string,
  period: AttendancePeriod,
  siteId: string | null,
  legacySite: string | null,
  includeLegacyNull: boolean,
  excludeId?: string,
): Promise<boolean> {
  const siteConditions: SQL[] = []
  if (siteId) siteConditions.push(eq(attendanceRecords.siteId, siteId))
  if (legacySite) siteConditions.push(eq(attendanceRecords.site, legacySite))
  if (includeLegacyNull) siteConditions.push(isNull(attendanceRecords.site))
  // Compatibilité défensive pour une ancienne ligne entièrement non répartie.
  if (siteConditions.length === 0) {
    siteConditions.push(and(isNull(attendanceRecords.siteId), isNull(attendanceRecords.site))!)
  }

  const existing = await db.query.attendanceRecords.findFirst({
    where: and(
      eq(attendanceRecords.ludoId, ludoId),
      eq(attendanceRecords.date, date),
      eq(attendanceRecords.period, period),
      or(...siteConditions),
    ),
  })
  return existing != null && existing.id !== excludeId
}
