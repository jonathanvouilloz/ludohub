import { error } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { getPublicSiteState } from '$lib/server/services/public-site.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async (event) => {
  const { ludo, member } = await requireLudoContext(event)
  const state = await getPublicSiteState(ludo.id)
  const canConfigure = isResponsable(member)

  if (!state.enabled && !canConfigure) {
    throw error(404, 'Module indisponible')
  }

  return { publicSiteState: state, canConfigure }
}
