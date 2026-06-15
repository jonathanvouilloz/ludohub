import { error } from '@sveltejs/kit'
import {
  getActiveSeason,
  getMyUpcomingSaturdays,
  getSeasonGrid,
} from '$lib/server/services/planning.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const { ludo, currentMember } = locals
  if (!ludo || !currentMember) throw error(403, 'Accès refusé')

  const responsable = isResponsable(currentMember)
  const activeSeason = await getActiveSeason(ludo.id)

  // Tout membre connecté voit la grille de la saison active + ses prochains samedis.
  // Seul·e un·e responsable peut éditer (contrôles masqués côté UI).
  const grid = activeSeason ? await getSeasonGrid(activeSeason.id, ludo.id) : null
  const upcoming = await getMyUpcomingSaturdays(currentMember.id)

  return {
    responsable,
    activeSeason: activeSeason ?? null,
    slots: grid?.slots ?? [],
    upcoming,
  }
}
