import { error } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(ludo.id))) throw error(404, 'Module indisponible')
  return { sites: await listSiteRowsWithOpeningHours(ludo.id) }
}
