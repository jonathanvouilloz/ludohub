import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import {
  PublicActivityRegistrationServiceError,
  listPublicActivityRegistrationsForManagement,
  transitionPublicActivityRegistration,
  updatePublicActivityRegistrationSettings,
} from '$lib/server/services/public-activity-registrations.js'
import type { PublicActivityRegistrationStatus } from '$lib/server/schema.js'

const STATUSES = new Set<PublicActivityRegistrationStatus>([
  'received',
  'waitlisted',
  'confirmed',
  'declined',
  'cancelled',
  'archived',
])

function noStore() {
  return { 'Cache-Control': 'no-store' }
}

function serviceError(error: unknown) {
  if (!(error instanceof PublicActivityRegistrationServiceError)) return null
  const status = error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400
  return json({ error: error.message }, { status, headers: noStore() })
}

export const GET: RequestHandler = async (event) => {
  const { ludo } = await requireResponsableContext(event)
  const requestedStatus = event.url.searchParams.get('status')
  if (requestedStatus && !STATUSES.has(requestedStatus as PublicActivityRegistrationStatus))
    return json({ error: 'Statut invalide.' }, { status: 400, headers: noStore() })
  const rawLimit = event.url.searchParams.get('limit')
  const limit = rawLimit === null ? 100 : Number(rawLimit)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)
    return json({ error: 'Limite invalide.' }, { status: 400, headers: noStore() })
  const registrations = await listPublicActivityRegistrationsForManagement(
    ludo.id,
    (requestedStatus || undefined) as PublicActivityRegistrationStatus | undefined,
    event.url.searchParams.get('activityId') || undefined,
    limit,
  )
  return json({ registrations }, { headers: noStore() })
}

export const PATCH: RequestHandler = async (event) => {
  const { ludo, member } = await requireResponsableContext(event)
  let body: Record<string, unknown>
  try {
    body = await event.request.json()
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error()
  } catch {
    return json({ error: 'JSON invalide.' }, { status: 400, headers: noStore() })
  }
  try {
    if (body.kind === 'status') {
      if (
        typeof body.id !== 'string' ||
        !STATUSES.has(body.status as PublicActivityRegistrationStatus)
      )
        return json({ error: 'Requête invalide.' }, { status: 400, headers: noStore() })
      const result = await transitionPublicActivityRegistration(
        body.id,
        ludo.id,
        body.status as PublicActivityRegistrationStatus,
        member.id,
        body.revision as number,
      )
      return json(result, { headers: noStore() })
    }
    if (body.kind === 'settings') {
      if (typeof body.activityId !== 'string')
        return json({ error: 'Requête invalide.' }, { status: 400, headers: noStore() })
      const result = await updatePublicActivityRegistrationSettings(
        body.activityId,
        ludo.id,
        member.id,
        { enabled: body.enabled as boolean, capacity: body.capacity as number | null },
        body.revision as number,
      )
      return json(result, { headers: noStore() })
    }
    return json({ error: 'Requête invalide.' }, { status: 400, headers: noStore() })
  } catch (error) {
    const response = serviceError(error)
    if (response) return response
    throw error
  }
}
