import type { MemberRow } from '$lib/server/schema.js'

/**
 * Guard : le membre est responsable de sa ludo.
 */
export function isResponsable(member: MemberRow | null | undefined): boolean {
  return member?.role === 'responsable'
}

/**
 * Guard : le membre est actif (non désactivé).
 */
export function isActiveMember(member: MemberRow | null | undefined): boolean {
  return member?.isActive === true
}

/**
 * Guard : le membre appartient bien à la ludo du slug courant.
 */
export function belongsToLudo(
  member: MemberRow | null | undefined,
  ludoId: string,
): boolean {
  return member?.ludoId === ludoId
}
