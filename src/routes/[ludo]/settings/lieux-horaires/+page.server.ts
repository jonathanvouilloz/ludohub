import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

/** Compatibilité avec les anciens favoris et liens partagés. */
export const load: PageServerLoad = async ({ params }) => {
  throw redirect(308, `/${params.ludo}/site-public/lieux-horaires`)
}
