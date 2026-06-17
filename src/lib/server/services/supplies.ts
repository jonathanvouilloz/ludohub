import {
  createSupply,
  deleteSupply,
  getSuppliesByLudo,
  getSupplyById,
  updateSupply,
} from '../db/supplies.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { MemberRow, SupplyRequestRow } from '../schema.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class SupplyServiceError extends Error {}

const CATEGORIES = ['jeux', 'materiel', 'fournitures', 'autre'] as const
const URGENCIES = ['normale', 'haute', 'critique'] as const
const STATUSES = ['en_attente', 'commande', 'recu'] as const

type SupplyCategory = (typeof CATEGORIES)[number]
type SupplyUrgency = (typeof URGENCIES)[number]
type SupplyStatus = (typeof STATUSES)[number]

/** Ordre d'affichage : la plus urgente en haut. */
const URGENCY_RANK: Record<SupplyUrgency, number> = { critique: 0, haute: 1, normale: 2 }

function parseName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new SupplyServiceError('Le nom est requis.')
  if (trimmed.length > 200) throw new SupplyServiceError('Le nom est trop long (200 max).')
  return trimmed
}

function parseCategory(value: string): SupplyCategory {
  if (!CATEGORIES.includes(value as SupplyCategory)) {
    throw new SupplyServiceError('Catégorie invalide.')
  }
  return value as SupplyCategory
}

function parseUrgency(value: string): SupplyUrgency {
  if (!URGENCIES.includes(value as SupplyUrgency)) {
    throw new SupplyServiceError('Urgence invalide.')
  }
  return value as SupplyUrgency
}

function parseStatus(value: string): SupplyStatus {
  if (!STATUSES.includes(value as SupplyStatus)) {
    throw new SupplyServiceError('Statut invalide.')
  }
  return value as SupplyStatus
}

/** Charge une demande et vérifie qu'elle appartient bien à la ludo. */
async function requireSupplyInLudo(id: string, ludoId: string) {
  const supply = await getSupplyById(id)
  if (!supply || supply.ludoId !== ludoId) {
    throw new SupplyServiceError('Demande introuvable.')
  }
  return supply
}

export async function listSupplyRequests(ludoId: string) {
  const rows = await getSuppliesByLudo(ludoId)
  // Tri secondaire par urgence (la DB renvoie déjà createdAt desc).
  return rows.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency])
}

export async function createSupplyRequest(
  ludoId: string,
  memberId: string,
  data: { name: string; category: string; urgency: string; notes?: string },
): Promise<SupplyRequestRow> {
  return createSupply({
    ludoId,
    memberId,
    name: parseName(data.name),
    category: parseCategory(data.category),
    urgency: parseUrgency(data.urgency),
    notes: data.notes?.trim() || null,
  })
}

/** Changement de statut : ouvert à tout membre actif (garde côté action). */
export async function updateSupplyStatus(
  id: string,
  ludoId: string,
  status: string,
): Promise<SupplyRequestRow> {
  await requireSupplyInLudo(id, ludoId)
  return updateSupply(id, { status: parseStatus(status) })
}

/** Suppression autorisée à l'auteur·e de la demande ou à un·e responsable. */
export async function deleteSupplyRequest(
  id: string,
  ludoId: string,
  member: MemberRow,
): Promise<void> {
  const supply = await requireSupplyInLudo(id, ludoId)
  if (supply.memberId !== member.id && !isResponsable(member)) {
    throw new SupplyServiceError('Vous ne pouvez supprimer que vos propres demandes.')
  }
  await deleteSupply(id)
}
