import {
  countActionRequired,
  listForRecipient,
  markAllRead,
  markRead,
} from '../db/notifications.js'
import type { NotificationRow, NotificationType } from '../schema.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class NotificationServiceError extends Error {}

// ─── Regroupement par domaine ────────────────────────────────────────────────

export type NotificationDomain = 'themes' | 'reseau' | 'absences'

const DOMAIN_OF: Record<NotificationType, NotificationDomain> = {
  theme_request: 'themes',
  theme_request_confirmed: 'themes',
  theme_request_declined: 'themes',
  help_response: 'reseau',
  help_confirmed: 'reseau',
  absence_request: 'absences',
  absence_approved: 'absences',
  absence_refused: 'absences',
}

const DOMAIN_ORDER: NotificationDomain[] = ['themes', 'reseau', 'absences']

const DOMAIN_LABEL: Record<NotificationDomain, string> = {
  themes: 'Thèmes',
  reseau: 'Réseau',
  absences: 'Absences',
}

export type NotificationGroup = {
  domain: NotificationDomain
  label: string
  items: NotificationRow[]
}

// ─── Lectures ────────────────────────────────────────────────────────────────

/** Boîte de réception du membre, groupée par domaine (groupes vides masqués). */
export async function getInbox(ludoId: string, memberId: string): Promise<NotificationGroup[]> {
  const rows = await listForRecipient(ludoId, memberId)
  return DOMAIN_ORDER.map((domain) => ({
    domain,
    label: DOMAIN_LABEL[domain],
    items: rows.filter((n) => DOMAIN_OF[n.type] === domain),
  })).filter((group) => group.items.length > 0)
}

/** Compteur du badge : `action_required` non lues uniquement. */
export async function getBadgeCount(ludoId: string, memberId: string): Promise<number> {
  return countActionRequired(ludoId, memberId)
}

// ─── Mutations (garde destinataire) ──────────────────────────────────────────

export async function read(id: string, ludoId: string, memberId: string): Promise<void> {
  const row = await markRead(id, ludoId, memberId)
  if (!row) throw new NotificationServiceError('Notification introuvable.')
}

export async function readAll(ludoId: string, memberId: string): Promise<void> {
  await markAllRead(ludoId, memberId)
}
