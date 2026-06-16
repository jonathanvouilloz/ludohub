import { getNetworkThemes } from '$lib/server/services/themes.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  const themes = await getNetworkThemes(ludo.id)
  return { themes }
}
