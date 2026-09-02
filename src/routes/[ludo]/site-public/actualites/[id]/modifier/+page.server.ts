import { error } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { getPublicNews, PublicNewsServiceError } from '$lib/server/services/public-news.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import type { PageServerLoad } from './$types'
export { actions } from '../../+page.server.js'

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(ludo.id))) throw error(404, 'Module indisponible')
  try {
    const [news, sites] = await Promise.all([
      getPublicNews(event.params.id, ludo.id),
      listSiteRowsWithOpeningHours(ludo.id),
    ])
    return { news, sites }
  } catch (cause) {
    if (cause instanceof PublicNewsServiceError) throw error(404, 'Actualité introuvable')
    throw cause
  }
}
