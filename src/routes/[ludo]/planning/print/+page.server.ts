import { error } from '@sveltejs/kit'
import { getActiveSeason, getSeasonGrid } from '$lib/server/services/planning.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { formatDateCH } from '$lib/utils/dates.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  const { ludo, member } = await requireLudoContext(event)
  const activeSeason = await getActiveSeason(ludo.id)
  if (!activeSeason) throw error(404, 'Aucune saison active.')

  const grid = await getSeasonGrid(activeSeason.id, ludo.id)

  return {
    ludoName: ludo.name,
    season: activeSeason,
    currentMemberId: member.id,
    currentMemberName: member.name,
    printedAt: formatDateCH(new Date()),
    slots: grid.slots,
  }
}
