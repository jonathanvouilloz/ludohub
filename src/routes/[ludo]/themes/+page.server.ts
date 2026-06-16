import { listThemes } from '$lib/server/services/themes.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  const themes = await listThemes(ludo.id)
  return { themes }
}
