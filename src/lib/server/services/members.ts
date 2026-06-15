import {
  countResponsablesActifs,
  createMember as dbCreateMember,
  getMemberById,
  hardDeleteMember,
  memberHasDependencies,
  softDeleteMember,
  updateMember as dbUpdateMember,
} from '../db/members.js'
import { belongsToLudo } from '$lib/utils/permissions.js'
import type { MemberRow } from '../schema.js'

/**
 * Erreur métier : message destiné à l'utilisateur (FR). Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class MemberServiceError extends Error {}

export type MemberRole = 'member' | 'responsable'

function parseRole(value: string): MemberRole {
  if (value !== 'member' && value !== 'responsable') {
    throw new MemberServiceError('Rôle invalide.')
  }
  return value
}

function parseName(value: string): string {
  const name = value.trim()
  if (!name) throw new MemberServiceError('Le nom est requis.')
  return name
}

/** Charge un membre et vérifie qu'il appartient bien à la ludo (défense tenant). */
async function requireMemberInLudo(id: string, ludoId: string): Promise<MemberRow> {
  const member = await getMemberById(id)
  if (!member || !belongsToLudo(member, ludoId)) {
    throw new MemberServiceError('Membre introuvable.')
  }
  return member
}

export async function createMember(
  ludoId: string,
  data: { name: string; role: string },
): Promise<MemberRow> {
  const name = parseName(data.name)
  const role = parseRole(data.role)
  return dbCreateMember({ ludoId, name, role })
}

export async function updateMember(
  id: string,
  ludoId: string,
  currentMemberId: string,
  data: { name: string; role: string },
): Promise<MemberRow> {
  const member = await requireMemberInLudo(id, ludoId)
  const name = parseName(data.name)
  const role = parseRole(data.role)

  // Garde-fou : rétrogradation d'un responsable en simple membre.
  const isDemotion = member.role === 'responsable' && role === 'member'
  if (isDemotion) {
    if (member.id === currentMemberId) {
      throw new MemberServiceError('Vous ne pouvez pas retirer votre propre rôle de responsable.')
    }
    if ((await countResponsablesActifs(ludoId)) <= 1) {
      throw new MemberServiceError('La ludothèque doit garder au moins un·e responsable.')
    }
  }

  return dbUpdateMember(id, { name, role })
}

export async function deactivateMember(
  id: string,
  ludoId: string,
  currentMemberId: string,
): Promise<void> {
  const member = await requireMemberInLudo(id, ludoId)

  if (member.id === currentMemberId) {
    throw new MemberServiceError('Vous ne pouvez pas désactiver votre propre compte.')
  }
  if (member.role === 'responsable' && (await countResponsablesActifs(ludoId)) <= 1) {
    throw new MemberServiceError('La ludothèque doit garder au moins un·e responsable actif·ve.')
  }

  await softDeleteMember(id)
}

export async function reactivateMember(id: string, ludoId: string): Promise<void> {
  await requireMemberInLudo(id, ludoId)
  await dbUpdateMember(id, { isActive: true })
}

export async function deleteMember(
  id: string,
  ludoId: string,
  currentMemberId: string,
): Promise<void> {
  const member = await requireMemberInLudo(id, ludoId)

  if (member.id === currentMemberId) {
    throw new MemberServiceError('Vous ne pouvez pas supprimer votre propre compte.')
  }
  if (member.role === 'responsable' && (await countResponsablesActifs(ludoId)) <= 1) {
    throw new MemberServiceError('La ludothèque doit garder au moins un·e responsable.')
  }
  if (await memberHasDependencies(id)) {
    throw new MemberServiceError(
      'Ce membre a des assignations ou absences : désactivez-le plutôt que de le supprimer.',
    )
  }

  await hardDeleteMember(id)
}
