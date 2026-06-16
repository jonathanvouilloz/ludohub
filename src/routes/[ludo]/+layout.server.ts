import { requireLudoContext } from '$lib/server/ludo-context.js'
import { getBadgeCount } from '$lib/server/services/notifications.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async (event) => {
  const { ludo, member } = await requireLudoContext(event)

  // Posé pour les `load` enfants (qui s'exécutent après ce layout).
  event.locals.ludo = ludo
  event.locals.currentMember = member

  const notifCount = await getBadgeCount(ludo.id, member.id)

  return { ludo, currentMember: member, notifCount }
}
