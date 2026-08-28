import { error } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import {
  getPublicActivity,
  PublicActivityServiceError,
} from '$lib/server/services/public-activities.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import type { PageServerLoad } from './$types'
export { actions } from '../+page.server.js'

export const load: PageServerLoad = async (event) => {
  const { ludo, member } = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(ludo.id))) throw error(404, 'Module indisponible')
  try {
    const [activity, sites] = await Promise.all([
      getPublicActivity(event.params.id, ludo.id),
      listSiteRowsWithOpeningHours(ludo.id),
    ])
    return { activity, sites, canManageRegistrations: member.role === 'responsable' }
  } catch (cause) {
    if (cause instanceof PublicActivityServiceError) throw error(404, 'Activité introuvable')
    throw cause
  }
}
