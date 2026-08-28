import { error } from '@sveltejs/kit'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import {
  getPublicActivityRegistration,
  PublicActivityRegistrationServiceError,
} from '$lib/server/services/public-activity-registrations.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import type { PageServerLoad } from './$types'
export { actions } from '../../activites/+page.server.js'

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireResponsableContext(event)
  if (!(await isPublicSiteEnabled(ludo.id))) throw error(404, 'Module indisponible')
  try {
    return { registration: await getPublicActivityRegistration(event.params.id, ludo.id) }
  } catch (cause) {
    if (cause instanceof PublicActivityRegistrationServiceError)
      throw error(404, 'Inscription introuvable')
    throw cause
  }
}
