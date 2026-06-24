import {
  createEventType,
  deleteEventType,
  getEventTypeById,
  listEventTypes,
  updateEventType,
} from '../db/eventTypes.js'
import type { EventTypeRow } from '../schema.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class EventTypeServiceError extends Error {}

/** Vrai si l'erreur est une violation d'unicité Postgres (code 23505). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === '23505'
}

function parseName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new EventTypeServiceError('Le nom est requis.')
  if (trimmed.length > 80) throw new EventTypeServiceError('Le nom est trop long (80 max).')
  return trimmed
}

/** Charge un type et vérifie qu'il appartient bien à la ludo. */
async function requireTypeInLudo(id: string, ludoId: string): Promise<EventTypeRow> {
  const type = await getEventTypeById(id)
  if (!type || type.ludoId !== ludoId) {
    throw new EventTypeServiceError("Type d'événement introuvable.")
  }
  return type
}

export async function listTypes(ludoId: string): Promise<EventTypeRow[]> {
  return listEventTypes(ludoId)
}

export async function createType(ludoId: string, data: { name: string }): Promise<EventTypeRow> {
  const name = parseName(data.name)
  try {
    return await createEventType({ ludoId, name })
  } catch (err) {
    if (isUniqueViolation(err)) throw new EventTypeServiceError('Ce type existe déjà.')
    throw err
  }
}

export async function renameType(
  id: string,
  ludoId: string,
  data: { name: string },
): Promise<EventTypeRow> {
  await requireTypeInLudo(id, ludoId)
  const name = parseName(data.name)
  try {
    return await updateEventType(id, { name })
  } catch (err) {
    if (isUniqueViolation(err)) throw new EventTypeServiceError('Ce type existe déjà.')
    throw err
  }
}

export async function archiveType(
  id: string,
  ludoId: string,
  archived: boolean,
): Promise<EventTypeRow> {
  await requireTypeInLudo(id, ludoId)
  return updateEventType(id, { isArchived: archived })
}

/**
 * Suppression définitive. L'historique de fréquentation retombe sur `eventLabel`
 * (snapshot du nom) car `attendance_records.eventTypeId` passe à null (FK set null).
 */
export async function deleteType(id: string, ludoId: string): Promise<void> {
  await requireTypeInLudo(id, ludoId)
  await deleteEventType(id)
}
