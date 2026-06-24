import { and, eq } from 'drizzle-orm'
import { db } from './index.js'
import { eventTypes, type EventTypeInsert } from '../schema.js'

// ─── Types d'événement (référentiel par ludo) ────────────────────────────────

export async function listEventTypes(ludoId: string, { includeArchived = false } = {}) {
  return db.query.eventTypes.findMany({
    where: includeArchived
      ? eq(eventTypes.ludoId, ludoId)
      : and(eq(eventTypes.ludoId, ludoId), eq(eventTypes.isArchived, false)),
    orderBy: (t, { asc }) => asc(t.name),
  })
}

export async function getEventTypeById(id: string) {
  return db.query.eventTypes.findFirst({ where: eq(eventTypes.id, id) })
}

export async function createEventType(data: EventTypeInsert) {
  const [type] = await db.insert(eventTypes).values(data).returning()
  return type
}

export async function updateEventType(
  id: string,
  data: Partial<Pick<EventTypeInsert, 'name' | 'isArchived'>>,
) {
  const [type] = await db.update(eventTypes).set(data).where(eq(eventTypes.id, id)).returning()
  return type
}

export async function deleteEventType(id: string): Promise<void> {
  await db.delete(eventTypes).where(eq(eventTypes.id, id))
}
