import {
  activateSeasonInDb,
  archiveSeason as dbArchiveSeason,
  clearAssignmentsBySeason,
  deleteAssignment,
  deleteClosurePeriod as dbDeleteClosurePeriod,
  deleteSeason as dbDeleteSeason,
  getActiveSeasonByLudo,
  getAssignment,
  getClosurePeriodById,
  getClosurePeriodsBySeason,
  getMemberSettingsBySeason,
  getSeasonById,
  getSeasonsByLudo,
  getSlotById,
  getSlotsBySeason,
  getUpcomingAssignmentsForMember,
  insertAssignment,
  insertClosurePeriod,
  insertSeason,
  insertSlots,
  setSlotCancelled,
  swapAssignments,
  updateSlotsRequiredCount,
  upsertMemberSetting,
} from '../db/planning.js'
import { getMemberById, getActiveMembersByLudo } from '../db/members.js'
import { insertAbsence } from '../db/absences.js'
import { getApprovedAbsencesByMember } from './absences.js'
import { belongsToLudo, isActiveMember } from '$lib/utils/permissions.js'
import { daysBetween, getSwissSaturdays, isDateInRange, isGenevaHoliday, toDateString } from '$lib/utils/dates.js'
import { type GEPeriod, geAcademicYears, parseGEVacancesHTML } from '$lib/utils/ge-vacances.js'
import type { AbsenceRow, ClosurePeriodRow, SeasonRow } from '../schema.js'

/**
 * Erreur métier : message destiné à l'utilisateur (FR). Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class PlanningServiceError extends Error {}

// ─── Helpers de validation ────────────────────────────────────────────────────

function parseSeasonName(value: string): string {
  const name = value.trim()
  if (!name) throw new PlanningServiceError('Le nom de la saison est requis.')
  return name
}

function parseDate(value: string, label: string): Date {
  const d = new Date(`${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) {
    throw new PlanningServiceError(`Date ${label} invalide.`)
  }
  return d
}

// ─── Gardes tenant ─────────────────────────────────────────────────────────────

/** Charge une saison et vérifie qu'elle appartient bien à la ludo. */
async function requireSeasonInLudo(id: string, ludoId: string): Promise<SeasonRow> {
  const season = await getSeasonById(id)
  if (!season || season.ludoId !== ludoId) {
    throw new PlanningServiceError('Saison introuvable.')
  }
  return season
}

/** Charge la saison d'un slot et vérifie qu'elle appartient à la ludo + n'est pas archivée. */
async function requireWritableSlot(slotId: string, ludoId: string) {
  const slot = await getSlotById(slotId)
  if (!slot) throw new PlanningServiceError('Samedi introuvable.')
  const season = await requireSeasonInLudo(slot.seasonId, ludoId)
  if (season.isArchived) {
    throw new PlanningServiceError('Cette saison est archivée (lecture seule).')
  }
  return { slot, season }
}

// ─── Saisons ───────────────────────────────────────────────────────────────────

export async function listSeasons(ludoId: string) {
  return getSeasonsByLudo(ludoId)
}

export async function getActiveSeason(ludoId: string) {
  return getActiveSeasonByLudo(ludoId)
}

/**
 * Charge la grille d'une saison et annote chaque assignation d'une absence
 * approuvée éventuelle (membre absent ce samedi). Le champ `absence` permet à
 * l'UI de marquer l'assigné et de le décompter de l'effectif rempli.
 */
export async function getSeasonGrid(seasonId: string, ludoId: string) {
  const season = await requireSeasonInLudo(seasonId, ludoId)
  const slots = await getSlotsBySeason(seasonId)

  const absencesByMember = await getApprovedAbsencesByMember(
    ludoId,
    season.startDate,
    season.endDate,
  )
  const closures = await getClosurePeriodsBySeason(seasonId)

  const enrichedSlots = slots.map((slot) => ({
    ...slot,
    // Plage de fermeture couvrant ce samedi (vacances, fermeture été…) ou `null`.
    closure: findCoveringClosure(closures, slot.date),
    assignments: slot.assignments.map((a) => ({
      ...a,
      absence: findCoveringAbsence(absencesByMember.get(a.memberId), slot.date),
    })),
  }))

  return { season, slots: enrichedSlots, closures }
}

/** Première absence de la liste couvrant la date du samedi, sinon `null`. */
function findCoveringAbsence(
  absences: AbsenceRow[] | undefined,
  slotDate: string,
): AbsenceRow | null {
  if (!absences) return null
  return absences.find((ab) => isDateInRange(slotDate, ab.startDate, ab.endDate)) ?? null
}

/** Première plage de fermeture couvrant la date du samedi, sinon `null`. */
function findCoveringClosure(
  closures: ClosurePeriodRow[],
  slotDate: string,
): ClosurePeriodRow | null {
  return closures.find((c) => isDateInRange(slotDate, c.startDate, c.endDate)) ?? null
}

export async function getMyUpcomingSaturdays(memberId: string) {
  return getUpcomingAssignmentsForMember(memberId, toDateString(new Date()))
}

/**
 * Crée une saison et génère automatiquement tous ses samedis.
 */
export async function createSeason(
  ludoId: string,
  data: {
    name: string
    startDate: string
    endDate: string
    requiredCount?: number
    activateNow?: boolean
  },
): Promise<SeasonRow> {
  const name = parseSeasonName(data.name)
  const start = parseDate(data.startDate, 'de début')
  const end = parseDate(data.endDate, 'de fin')
  if (start > end) {
    throw new PlanningServiceError('La date de début doit précéder la date de fin.')
  }
  const requiredCount = data.requiredCount ?? 3

  const season = await insertSeason({
    ludoId,
    name,
    startDate: toDateString(start),
    endDate: toDateString(end),
  })

  const saturdays = getSwissSaturdays(start, end)
  await insertSlots(
    saturdays.map((date) => ({
      seasonId: season.id,
      date: toDateString(date),
      requiredCount,
    })),
  )

  if (data.activateNow) {
    const current = await getActiveSeasonByLudo(ludoId)
    await activateSeasonInDb(season.id, current?.id ?? null)
  }

  return season
}

/** Active une saison et archive automatiquement la précédente active. */
export async function activateSeason(seasonId: string, ludoId: string): Promise<void> {
  const season = await requireSeasonInLudo(seasonId, ludoId)
  if (season.isArchived) throw new PlanningServiceError("Impossible d'activer une saison archivée.")
  if (season.isActive) return
  const current = await getActiveSeasonByLudo(ludoId)
  await activateSeasonInDb(seasonId, current?.id ?? null)
}

export async function archiveSeason(
  id: string,
  ludoId: string,
  archived: boolean,
): Promise<SeasonRow> {
  const season = await requireSeasonInLudo(id, ludoId)
  // Si on archive une saison active, la désactiver en même temps
  if (archived && season.isActive) {
    return dbArchiveSeason(id, archived, true)
  }
  return dbArchiveSeason(id, archived)
}

export async function deleteSeason(id: string, ludoId: string): Promise<void> {
  await requireSeasonInLudo(id, ludoId)
  await dbDeleteSeason(id)
}

// ─── Plages de fermeture / vacances ────────────────────────────────────────────

export async function createClosurePeriod(
  seasonId: string,
  ludoId: string,
  data: { label: string; startDate: string; endDate: string },
): Promise<ClosurePeriodRow> {
  const season = await requireSeasonInLudo(seasonId, ludoId)
  if (season.isArchived) {
    throw new PlanningServiceError('Cette saison est archivée (lecture seule).')
  }
  const label = data.label.trim()
  if (!label) throw new PlanningServiceError('Le libellé de la plage est requis.')
  const start = parseDate(data.startDate, 'de début')
  const end = parseDate(data.endDate, 'de fin')
  if (start > end) {
    throw new PlanningServiceError('La date de début doit précéder la date de fin.')
  }

  return insertClosurePeriod({
    seasonId,
    label,
    startDate: toDateString(start),
    endDate: toDateString(end),
  })
}

/**
 * Importe les vacances scolaires genevoises depuis ge.ch et les crée comme
 * closure_periods pour la saison. Filtre les périodes qui ne chevauchent pas
 * la saison. Retourne le nombre de périodes créées.
 */
export async function importGEVacations(seasonId: string, ludoId: string): Promise<number> {
  const season = await requireSeasonInLudo(seasonId, ludoId)
  if (season.isArchived) throw new PlanningServiceError('Cette saison est archivée (lecture seule).')

  // Déterminer les années académiques couvertes par la saison (1 ou 2 si la saison chevauche deux années scolaires)
  const academicYears = geAcademicYears(season.startDate, season.endDate)

  const allPeriods: GEPeriod[] = []
  for (const ay of academicYears) {
    const url = `https://www.ge.ch/vacances-scolaires-jours-feries/vacances-scolaires-${ay}`
    let html: string
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new PlanningServiceError(
          `Impossible de contacter ge.ch pour ${ay} (erreur ${response.status}).`,
        )
      }
      html = await response.text()
    } catch (err) {
      if (err instanceof PlanningServiceError) throw err
      throw new PlanningServiceError('Impossible de contacter ge.ch. Vérifiez la connexion réseau.')
    }
    allPeriods.push(...parseGEVacancesHTML(html))
  }

  // Dédupliquer par (label + startDate) si deux années académiques fournissent le même résultat
  const seen = new Set<string>()
  const periods = allPeriods.filter((p) => {
    const key = `${p.label}|${p.startDate}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Garder seulement les périodes qui chevauchent la plage de la saison
  const overlapping = periods.filter(
    (p) => p.startDate <= season.endDate && p.endDate >= season.startDate,
  )

  for (const p of overlapping) {
    await insertClosurePeriod({
      seasonId,
      label: p.label,
      startDate: p.startDate,
      endDate: p.endDate,
    })
  }

  return overlapping.length
}

export async function deleteClosurePeriod(id: string, ludoId: string): Promise<void> {
  const period = await getClosurePeriodById(id)
  if (!period) throw new PlanningServiceError('Plage introuvable.')
  await requireSeasonInLudo(period.seasonId, ludoId)
  await dbDeleteClosurePeriod(id)
}

// ─── Assignations ──────────────────────────────────────────────────────────────

/**
 * Assigne un membre actif de la ludo à un samedi. Lève une erreur si déjà assigné.
 */
export async function assignMember(
  slotId: string,
  memberId: string,
  ludoId: string,
): Promise<void> {
  await requireWritableSlot(slotId, ludoId)

  const member = await getMemberById(memberId)
  if (!member || !belongsToLudo(member, ludoId)) {
    throw new PlanningServiceError('Membre introuvable.')
  }
  if (!isActiveMember(member)) {
    throw new PlanningServiceError('Ce membre est inactif.')
  }

  const existing = await getAssignment(slotId, memberId)
  if (existing) {
    throw new PlanningServiceError('Ce membre est déjà assigné à ce samedi.')
  }

  await insertAssignment({ slotId, memberId })
}

export async function removeMember(
  slotId: string,
  memberId: string,
  ludoId: string,
): Promise<void> {
  await requireWritableSlot(slotId, ludoId)
  await deleteAssignment(slotId, memberId)
}

/**
 * Échange croisé entre deux membres sur deux samedis distincts (atomique).
 */
export async function swapMembers(
  slotAId: string,
  memberAId: string,
  slotBId: string,
  memberBId: string,
  ludoId: string,
): Promise<void> {
  if (slotAId === slotBId) {
    throw new PlanningServiceError('Choisissez deux samedis différents.')
  }
  await requireWritableSlot(slotAId, ludoId)
  await requireWritableSlot(slotBId, ludoId)

  const a = await getAssignment(slotAId, memberAId)
  const b = await getAssignment(slotBId, memberBId)
  if (!a || !b) {
    throw new PlanningServiceError('Les assignations à échanger sont introuvables.')
  }

  await swapAssignments(slotAId, memberAId, slotBId, memberBId)
}

/**
 * Échange initié par un membre : il propose d'échanger SON samedi (slotA) contre
 * celui d'un·e collègue (slotB). Autorisé seulement si le demandeur est bien la
 * personne assignée au slotA (ou un·e responsable, qui passe par `swapMembers`).
 */
export async function requestSwap(
  requestingMemberId: string,
  slotAId: string,
  memberAId: string,
  slotBId: string,
  memberBId: string,
  ludoId: string,
): Promise<void> {
  if (requestingMemberId !== memberAId) {
    throw new PlanningServiceError('Vous ne pouvez échanger que votre propre samedi.')
  }
  await swapMembers(slotAId, memberAId, slotBId, memberBId, ludoId)
}

// ─── Samedis (annulation) ────────────────────────────────────────────────────────

export async function cancelSlot(slotId: string, ludoId: string): Promise<void> {
  await requireWritableSlot(slotId, ludoId)
  await setSlotCancelled(slotId, true)
}

export async function reopenSlot(slotId: string, ludoId: string): Promise<void> {
  await requireWritableSlot(slotId, ludoId)
  await setSlotCancelled(slotId, false)
}

// ─── Configuration membres par saison ────────────────────────────────────────

export async function saveMemberConfig(
  seasonId: string,
  ludoId: string,
  memberId: string,
  isPermanent: boolean,
): Promise<void> {
  await requireSeasonInLudo(seasonId, ludoId)
  const member = await getMemberById(memberId)
  if (!member || !belongsToLudo(member, ludoId)) {
    throw new PlanningServiceError('Membre introuvable.')
  }
  await upsertMemberSetting({ seasonId, memberId, isPermanent })
}

/**
 * Crée une indisponibilité pré-planifiée pour un membre sur une saison.
 * Insérée directement avec status='approuve' car c'est le/la responsable qui la saisit.
 * Elle apparaît dans la vue planning (warnings d'absence) comme toute absence approuvée.
 */
export async function addMemberUnavailability(
  seasonId: string,
  ludoId: string,
  memberId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  const season = await requireSeasonInLudo(seasonId, ludoId)
  if (season.isArchived) throw new PlanningServiceError('Cette saison est archivée (lecture seule).')

  const member = await getMemberById(memberId)
  if (!member || !belongsToLudo(member, ludoId)) {
    throw new PlanningServiceError('Membre introuvable.')
  }

  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime())) throw new PlanningServiceError('Date de début invalide.')
  if (Number.isNaN(end.getTime())) throw new PlanningServiceError('Date de fin invalide.')
  if (start > end) throw new PlanningServiceError('La date de début doit précéder la date de fin.')

  await insertAbsence({
    ludoId,
    memberId,
    type: 'vacances',
    startDate: toDateString(start),
    endDate: toDateString(end),
    status: 'approuve',
    notes: `Indisponibilité saisie lors de la configuration de la saison « ${season.name} »`,
  })
}

// ─── Génération automatique du planning ──────────────────────────────────────

export type GenerateResult = {
  slotsGenerated: number
  assignmentsCreated: number
  slotsAutoCancelled: number
}

/**
 * Génère automatiquement les assignations pour une saison.
 *
 * Algorithme :
 *   1. Auto-annule les samedis fériés GE (isGenevaHoliday).
 *   2. Exclut les samedis en plage de fermeture.
 *   3. Phase permanents : assigne les membres permanents sur tous les samedis
 *      travaillables (sauf absence approuvée).
 *   4. Phase pool : distribue les membres non-permanents équitablement.
 *      Contraintes : pas 2 samedis consécutifs d'affilée, priorité aux moins
 *      chargés, ordre aléatoire à égalité.
 *
 * Appeler clearAssignmentsBySeason() avant si on regénère (fait par l'action).
 */
export async function generatePlanning(
  seasonId: string,
  ludoId: string,
  requiredCount?: number,
): Promise<GenerateResult> {
  const season = await requireSeasonInLudo(seasonId, ludoId)
  if (season.isArchived) throw new PlanningServiceError('Cette saison est archivée (lecture seule).')

  // Mettre à jour l'effectif requis sur tous les slots si fourni
  if (requiredCount !== undefined && requiredCount >= 1) {
    await updateSlotsRequiredCount(seasonId, requiredCount)
  }

  const [slots, closures, activeMembers, memberSettings, absencesByMember] = await Promise.all([
    getSlotsBySeason(seasonId),
    getClosurePeriodsBySeason(seasonId),
    getActiveMembersByLudo(ludoId),
    getMemberSettingsBySeason(seasonId),
    getApprovedAbsencesByMember(ludoId, season.startDate, season.endDate),
  ])

  const settingsMap = new Map(memberSettings.map((s) => [s.memberId, s.isPermanent]))
  const permanents = activeMembers.filter((m) => settingsMap.get(m.id) === true)
  const pool = activeMembers.filter((m) => settingsMap.get(m.id) !== true)

  function hasAbsence(memberId: string, date: string): boolean {
    const abs = absencesByMember.get(memberId) ?? []
    return abs.some((a) => isDateInRange(date, a.startDate, a.endDate))
  }

  function isInClosure(date: string): boolean {
    return closures.some((c) => isDateInRange(date, c.startDate, c.endDate))
  }

  // Phase 0 — auto-annuler les samedis fériés GE non encore annulés
  let slotsAutoCancelled = 0
  for (const slot of slots) {
    if (!slot.isCancelled && isGenevaHoliday(slot.date)) {
      await setSlotCancelled(slot.id, true)
      slot.isCancelled = true
      slotsAutoCancelled++
    }
  }

  const workableSlots = slots.filter((s) => !s.isCancelled && !isInClosure(s.date))
  let assignmentsCreated = 0

  // Phase 1 — Permanents : tous les samedis travaillables sauf absence
  for (const slot of workableSlots) {
    for (const member of permanents) {
      if (hasAbsence(member.id, slot.date)) continue
      try {
        await insertAssignment({ slotId: slot.id, memberId: member.id })
        assignmentsCreated++
      } catch {
        // UNIQUE violation → déjà assigné, ignorer
      }
    }
  }

  // Phase 2 — Pool : distribution équitable avec contrainte consécutif
  type Tracker = { total: number; lastDates: string[] }
  const tracker = new Map<string, Tracker>(pool.map((m) => [m.id, { total: 0, lastDates: [] }]))

  // Nombre de permanents présents par slot (pour calculer le besoin restant)
  const permanentsPerSlot = new Map<string, number>()
  for (const slot of workableSlots) {
    permanentsPerSlot.set(slot.id, permanents.filter((m) => !hasAbsence(m.id, slot.date)).length)
  }

  for (const slot of workableSlots) {
    const alreadyFilled = permanentsPerSlot.get(slot.id) ?? 0
    const needed = Math.max(0, slot.requiredCount - alreadyFilled)
    if (needed === 0) continue

    const eligible = pool.filter((m) => {
      if (hasAbsence(m.id, slot.date)) return false
      const t = tracker.get(m.id)!
      if (t.lastDates.length >= 2) {
        // Bloquer si les 2 derniers samedis assignés étaient consécutifs avec celui-ci
        const last = t.lastDates[t.lastDates.length - 1]
        const prev = t.lastDates[t.lastDates.length - 2]
        if (daysBetween(last, slot.date) === 7 && daysBetween(prev, last) === 7) return false
      }
      return true
    })

    // Trier : moins chargés d'abord, aléatoire à égalité
    eligible.sort((a, b) => {
      const diff = tracker.get(a.id)!.total - tracker.get(b.id)!.total
      return diff !== 0 ? diff : Math.random() - 0.5
    })

    for (const member of eligible.slice(0, needed)) {
      try {
        await insertAssignment({ slotId: slot.id, memberId: member.id })
        assignmentsCreated++
        const t = tracker.get(member.id)!
        t.total++
        t.lastDates.push(slot.date)
        if (t.lastDates.length > 2) t.lastDates.shift()
      } catch {
        // UNIQUE violation → ignorer
      }
    }
  }

  return { slotsGenerated: workableSlots.length, assignmentsCreated, slotsAutoCancelled }
}
