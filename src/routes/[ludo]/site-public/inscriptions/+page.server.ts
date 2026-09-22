import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

/** Les inscriptions aux activités ne sont plus proposées. */
export const load: PageServerLoad = async (event) => {
  redirect(303, `/${event.params.ludo}/site-public/activites`)
}
