import { and, count, desc, eq, isNull, or } from 'drizzle-orm'
import { db } from './index.js'
import {
  notifications,
  type NotificationInsert,
  type NotificationRow,
  type NotificationType,
} from '../schema.js'

/**
 * Notifs visibles par un membre : celles adressées à toute la ludo
 * (`recipientMemberId` null) + celles qui lui sont nominatives.
 */
function visibleTo(ludoId: string, memberId: string) {
  return and(
    eq(notifications.recipientLudoId, ludoId),
    or(isNull(notifications.recipientMemberId), eq(notifications.recipientMemberId, memberId)),
  )
}

/** Insert batch depuis le dispatcher (no-op si rien à écrire). */
export async function createNotifications(rows: NotificationInsert[]): Promise<void> {
  if (rows.length === 0) return
  await db.insert(notifications).values(rows)
}

export async function listForRecipient(
  ludoId: string,
  memberId: string,
  opts: { unreadOnly?: boolean } = {},
): Promise<NotificationRow[]> {
  const where = opts.unreadOnly
    ? and(visibleTo(ludoId, memberId), eq(notifications.isRead, false))
    : visibleTo(ludoId, memberId)
  return db.query.notifications.findMany({
    where,
    orderBy: desc(notifications.createdAt),
  })
}

/** Nombre de notifs `action_required` non lues visibles par le membre (alimente le badge). */
export async function countActionRequired(ludoId: string, memberId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        visibleTo(ludoId, memberId),
        eq(notifications.severity, 'action_required'),
        eq(notifications.isRead, false),
      ),
    )
  return row?.value ?? 0
}

/** Marque lue une notif, gardée sur le destinataire (ludo + membre/ludo entière). */
export async function markRead(
  id: string,
  ludoId: string,
  memberId: string,
): Promise<NotificationRow | undefined> {
  const [row] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), visibleTo(ludoId, memberId)))
    .returning()
  return row
}

export async function markAllRead(ludoId: string, memberId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(visibleTo(ludoId, memberId), eq(notifications.isRead, false)))
}

/**
 * Idempotence : vrai si une notif non lue identique (type + entité + destinataire)
 * existe déjà, pour ne pas dupliquer lors d'un rejeu de l'événement.
 */
export async function hasUnreadNotification(
  type: NotificationType,
  entityId: string,
  recipientLudoId: string,
  recipientMemberId: string | null,
): Promise<boolean> {
  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.type, type),
      eq(notifications.entityId, entityId),
      eq(notifications.recipientLudoId, recipientLudoId),
      recipientMemberId
        ? eq(notifications.recipientMemberId, recipientMemberId)
        : isNull(notifications.recipientMemberId),
      eq(notifications.isRead, false),
    ),
    columns: { id: true },
  })
  return Boolean(existing)
}
