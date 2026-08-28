import { error } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { getPublicNews, PublicNewsServiceError } from '$lib/server/services/public-news.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(ludo.id))) throw error(404, 'Module indisponible')
  try {
    return { news: await getPublicNews(event.params.id, ludo.id) }
  } catch (cause) {
    if (cause instanceof PublicNewsServiceError) throw error(404, 'Actualité introuvable')
    throw cause
  }
}
