import { error } from '@sveltejs/kit'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import { listPublicActivitiesForManagement } from '$lib/server/services/public-activities.js'
import { listPublicActivityRegistrationsForManagement } from '$lib/server/services/public-activity-registrations.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import type { PublicActivityRegistrationStatus } from '$lib/server/schema.js'
import type { PageServerLoad } from './$types'
export { actions } from '../activites/+page.server.js'

const statuses = [
  'received',
  'waitlisted',
  'confirmed',
  'declined',
  'cancelled',
  'archived',
] as const
export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireResponsableContext(event)
  if (!(await isPublicSiteEnabled(ludo.id))) throw error(404, 'Module indisponible')
  const requested = event.url.searchParams.get('registrationStatus') ?? ''
  const status = statuses.includes(requested as (typeof statuses)[number])
    ? (requested as PublicActivityRegistrationStatus)
    : undefined
  const activityId = event.url.searchParams.get('registrationActivity') || undefined
  const [registrations, activities] = await Promise.all([
    listPublicActivityRegistrationsForManagement(ludo.id, status, activityId),
    listPublicActivitiesForManagement(ludo.id),
  ])
  return {
    registrations,
    activities,
    filters: { status: status ?? '', activityId: activityId ?? '' },
  }
}
