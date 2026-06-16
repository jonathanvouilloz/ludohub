import { requireLudoContext } from '$lib/server/ludo-context.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async (event) => {
  const { ludo, member } = await requireLudoContext(event)

  // Posé pour les `load` enfants (qui s'exécutent après ce layout).
  event.locals.ludo = ludo
  event.locals.currentMember = member

  return { ludo, currentMember: member }
}
