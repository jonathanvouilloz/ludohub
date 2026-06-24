import { error } from '@sveltejs/kit'
import { getThemeDetail } from '$lib/server/services/themes.js'
import { formatDateCH } from '$lib/utils/dates.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
  const { ludo } = await parent()
  const theme = await getThemeDetail(params.id, ludo.id).catch(() => null)
  if (!theme) throw error(404, 'Thème introuvable')

  // Date d'impression figée côté serveur (jamais de `new Date()` dans le composant).
  return {
    theme,
    ludoName: ludo.name,
    printedAt: formatDateCH(new Date()),
  }
}
