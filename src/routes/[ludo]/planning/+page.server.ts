import {
  getActiveSeason,
  getMyUpcomingSaturdays,
  getSeasonGrid,
} from '$lib/server/services/planning.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  // `ludo`/`currentMember` viennent du `+layout.server.ts` parent : `await parent()`
  // garantit qu'ils sont posés (sinon course concurrente entre les `load` → 403).
  const { ludo, currentMember } = await parent()

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
