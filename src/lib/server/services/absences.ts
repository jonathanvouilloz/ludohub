import {
  deleteAbsence,
  getAbsenceById,
  getAbsencesByLudo,
  getAbsencesByMember,
  getApprovedAbsencesInRange,
  insertAbsence,
  updateAbsenceStatus,
} from '../db/absences.js'
import type { AbsenceRow } from '../schema.js'
import { emitEvent } from './events.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class AbsenceServiceError extends Error {}

const ABSENCE_TYPES = ['conge', 'vacances', 'formation', 'indisponible'] as const
type AbsenceType = (typeof ABSENCE_TYPES)[number]

function parseType(value: string): AbsenceType {
  if (!(ABSENCE_TYPES as readonly string[]).includes(value)) {
    throw new AbsenceServiceError("Type d'absence invalide.")
  }
  return value as AbsenceType
}

function parseDate(value: string, label: string): string {
  const d = new Date(`${value}T12:00:00`)
  if (!value || Number.isNaN(d.getTime())) {
    throw new AbsenceServiceError(`Date ${label} invalide.`)
  }
  return value
}

// ─── Demandes ────────────────────────────────────────────────────────────────

/** Soumet une nouvelle demande d'absence (statut `en_attente`). */
export async function requestAbsence(data: {
  ludoId: string
  memberId: string
  type: string
  startDate: string
  endDate: string
  notes?: string
}): Promise<AbsenceRow> {
  const type = parseType(data.type)
  const startDate = parseDate(data.startDate, 'de début')
  const endDate = parseDate(data.endDate, 'de fin')
  if (startDate > endDate) {
    throw new AbsenceServiceError('La date de début doit précéder la date de fin.')
  }

  const absence = await insertAbsence({
    ludoId: data.ludoId,
    memberId: data.memberId,
    type,
    startDate,
    endDate,
    notes: data.notes?.trim() || null,
    status: 'en_attente',
  })

  await emitEvent({
    type: 'absence_request',
    actorLudoId: data.ludoId,
    actorMemberId: data.memberId,
    entityType: 'absence',
    entityId: absence.id,
    title: "Nouvelle demande d'absence",
    body: 'Une demande d’absence attend votre décision.',
    recipientResponsablesOf: data.ludoId,
  })

  return absence
}

/** Charge une absence et vérifie qu'elle appartient bien à la ludo. */
async function requireAbsenceInLudo(id: string, ludoId: string): Promise<AbsenceRow> {
  const absence = await getAbsenceById(id)
  if (!absence || absence.ludoId !== ludoId) {
    throw new AbsenceServiceError('Demande introuvable.')
  }
  return absence
}

/** Approbation responsable. Note optionnelle. */
export async function approveAbsence(
  id: string,
  ludoId: string,
  responderId: string,
  note?: string,
): Promise<AbsenceRow> {
  const absence = await requireAbsenceInLudo(id, ludoId)
  if (absence.status !== 'en_attente') {
    throw new AbsenceServiceError('Cette demande a déjà été traitée.')
  }
  const updated = await updateAbsenceStatus(id, {
    status: 'approuve',
    responderNotes: note?.trim() || null,
    respondedBy: responderId,
  })

  await emitEvent({
    type: 'absence_approved',
    actorLudoId: ludoId,
    actorMemberId: responderId,
    entityType: 'absence',
    entityId: id,
    title: 'Absence approuvée',
    body: 'Votre demande d’absence a été approuvée.',
    recipientLudoId: ludoId,
    recipientMemberId: absence.memberId,
  })

  return updated
}

/** Refus responsable. Note obligatoire. */
export async function refuseAbsence(
  id: string,
  ludoId: string,
  responderId: string,
  note: string,
): Promise<AbsenceRow> {
  const absence = await requireAbsenceInLudo(id, ludoId)
  if (absence.status !== 'en_attente') {
    throw new AbsenceServiceError('Cette demande a déjà été traitée.')
  }
  const trimmed = note?.trim()
  if (!trimmed) {
    throw new AbsenceServiceError('Une note est requise pour refuser une demande.')
  }
  const updated = await updateAbsenceStatus(id, {
    status: 'refuse',
    responderNotes: trimmed,
    respondedBy: responderId,
  })

  await emitEvent({
    type: 'absence_refused',
    actorLudoId: ludoId,
    actorMemberId: responderId,
    entityType: 'absence',
    entityId: id,
    title: 'Absence refusée',
    body: 'Votre demande d’absence a été refusée.',
    recipientLudoId: ludoId,
    recipientMemberId: absence.memberId,
  })

  return updated
}

/** Annulation par le membre propriétaire, tant que la demande est en attente. */
export async function cancelOwnAbsence(id: string, memberId: string): Promise<void> {
  const absence = await getAbsenceById(id)
  if (!absence || absence.memberId !== memberId) {
    throw new AbsenceServiceError('Demande introuvable.')
  }
  if (absence.status !== 'en_attente') {
    throw new AbsenceServiceError('Seules les demandes en attente peuvent être annulées.')
  }
  await deleteAbsence(id)
}

// ─── Lectures ────────────────────────────────────────────────────────────────

export async function listAbsencesForMember(memberId: string) {
  return getAbsencesByMember(memberId)
}

export async function listAbsencesForLudo(ludoId: string) {
  return getAbsencesByLudo(ludoId)
}

/**
 * Construit l'index des absences approuvées par membre sur une plage de dates.
 * Clé = memberId, valeur = absences approuvées du membre chevauchant la plage.
 * Consommé par le planning pour marquer/décompter les assignés absents.
 */
export async function getApprovedAbsencesByMember(
  ludoId: string,
  startDate: string,
  endDate: string,
): Promise<Map<string, AbsenceRow[]>> {
  const rows = await getApprovedAbsencesInRange(ludoId, startDate, endDate)
  const byMember = new Map<string, AbsenceRow[]>()
  for (const row of rows) {
    const list = byMember.get(row.memberId)
    if (list) list.push(row)
    else byMember.set(row.memberId, [row])
  }
  return byMember
}
