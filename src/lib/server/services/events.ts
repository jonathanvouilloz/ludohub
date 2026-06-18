import { insertActivity } from '../db/activity_log.js'
import { getActiveResponsables } from '../db/members.js'
import { createNotifications, hasUnreadNotification } from '../db/notifications.js'
import type { NotificationInsert, NotificationSeverity, NotificationType } from '../schema.js'

/**
 * Dispatcher d'événements de domaine. Point d'émission UNIQUE : un service appelle
 * `emitEvent` une fois, et le dispatcher écrit à la fois la ligne d'audit
 * (`activity_log`, pour le super-admin) ET les notifications par destinataire
 * (fan-out 1→N). Voir `docs/features/10-notifications.md` pour la décision d'archi.
 *
 * Le dispatch est best-effort : il ne doit JAMAIS faire échouer l'action métier.
 */

type Recipient = { ludoId: string; memberId: string | null }

export type DomainEvent = {
  type: NotificationType
  /** Ludo (et éventuellement membre) à l'origine de l'action — écrit dans l'audit. */
  actorLudoId: string
  actorMemberId?: string | null
  /** Entité concernée, pour le lien profond depuis la notif. */
  entityType: string
  entityId: string
  title: string
  body?: string | null
  /** Destinataire « ludo entière » (cas cross-ludo). */
  recipientLudoId?: string
  /** Destinataire nominatif (ex. absence approuvée → le membre demandeur). */
  recipientMemberId?: string | null
  /** Fan-out : notifie tous les responsables actifs de cette ludo. */
  recipientResponsablesOf?: string
  metadata?: Record<string, unknown>
}

/** Sévérité par type d'événement (seules les `action_required` alimentent le badge). */
const SEVERITY: Record<NotificationType, NotificationSeverity> = {
  theme_request: 'action_required',
  theme_request_confirmed: 'info',
  theme_request_declined: 'info',
  help_response: 'action_required',
  help_confirmed: 'info',
  absence_request: 'action_required',
  absence_approved: 'info',
  absence_refused: 'info',
  theme_installed: 'info',
  installation_closed: 'info',
  checkup_recorded: 'info',
  checkup_missing_item: 'action_required',
  supply_request: 'action_required',
}

async function resolveRecipients(event: DomainEvent): Promise<Recipient[]> {
  if (event.recipientResponsablesOf) {
    const responsables = await getActiveResponsables(event.recipientResponsablesOf)
    return responsables.map((m) => ({ ludoId: event.recipientResponsablesOf!, memberId: m.id }))
  }
  if (event.recipientLudoId) {
    return [{ ludoId: event.recipientLudoId, memberId: event.recipientMemberId ?? null }]
  }
  return []
}

export async function emitEvent(event: DomainEvent): Promise<void> {
  try {
    // 1. Audit (acteur) — peuple `activity_log` pour 11-ADMIN.
    await insertActivity({
      ludoId: event.actorLudoId,
      memberId: event.actorMemberId ?? null,
      action: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata: event.metadata ?? null,
    })

    // 2. Fan-out notifications par destinataire.
    const severity = SEVERITY[event.type]
    const recipients = await resolveRecipients(event)
    const rows: NotificationInsert[] = []
    for (const recipient of recipients) {
      // Pas d'auto-notification de l'acteur.
      if (recipient.memberId && recipient.memberId === event.actorMemberId) continue
      // Idempotence : ne pas dupliquer si l'événement est rejoué.
      const exists = await hasUnreadNotification(
        event.type,
        event.entityId,
        recipient.ludoId,
        recipient.memberId,
      )
      if (exists) continue
      rows.push({
        recipientLudoId: recipient.ludoId,
        recipientMemberId: recipient.memberId,
        type: event.type,
        severity,
        entityType: event.entityType,
        entityId: event.entityId,
        title: event.title,
        body: event.body ?? null,
      })
    }
    await createNotifications(rows)
  } catch (err) {
    // Best-effort : on loggue mais on ne propage pas (l'action de domaine prime).
    console.error('[events] emitEvent failed', { type: event.type, entityId: event.entityId }, err)
  }
}
