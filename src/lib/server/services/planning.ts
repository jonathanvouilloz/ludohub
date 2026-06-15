import {
  archiveSeason as dbArchiveSeason,
  deleteAssignment,
  deleteSeason as dbDeleteSeason,
  getActiveSeasonByLudo,
  getAssignment,
  getSeasonById,
  getSeasonsByLudo,
  getSlotById,
  getSlotsBySeason,
  getUpcomingAssignmentsForMember,
  insertAssignment,
  insertSeason,
  insertSlots,
  setSlotCancelled,
  swapAssignments,
} from '../db/planning.js'
import { getMemberById } from '../db/members.js'
import { belongsToLudo, isActiveMember } from '$lib/utils/permissions.js'
import { getSwissSaturdays, toDateString } from '$lib/utils/dates.js'
import type { SeasonRow } from '../schema.js'

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

export async function getSeasonGrid(seasonId: string, ludoId: string) {
  const season = await requireSeasonInLudo(seasonId, ludoId)
  const slots = await getSlotsBySeason(seasonId)
  return { season, slots }
}

export async function getMyUpcomingSaturdays(memberId: string) {
  return getUpcomingAssignmentsForMember(memberId, toDateString(new Date()))
}

/**
 * Crée une saison et génère automatiquement tous ses samedis.
 */
export async function createSeason(
  ludoId: string,
  data: { name: string; startDate: string; endDate: string; requiredCount?: number },
): Promise<SeasonRow> {
  const name = parseSeasonName(data.name)
  const start = parseDate(data.startDate, 'de début')
  const end = parseDate(data.endDate, 'de fin')
  if (start > end) {
    throw new PlanningServiceError('La date de début doit précéder la date de fin.')
  }
  const requiredCount = data.requiredCount ?? 2

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

  return season
}

export async function archiveSeason(
  id: string,
  ludoId: string,
  archived: boolean,
): Promise<SeasonRow> {
  await requireSeasonInLudo(id, ludoId)
  return dbArchiveSeason(id, archived)
}

export async function deleteSeason(id: string, ludoId: string): Promise<void> {
  await requireSeasonInLudo(id, ludoId)
  await dbDeleteSeason(id)
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

// ─── Samedis (annulation) ────────────────────────────────────────────────────────

export async function cancelSlot(slotId: string, ludoId: string): Promise<void> {
  await requireWritableSlot(slotId, ludoId)
  await setSlotCancelled(slotId, true)
}

export async function reopenSlot(slotId: string, ludoId: string): Promise<void> {
  await requireWritableSlot(slotId, ludoId)
  await setSlotCancelled(slotId, false)
}
