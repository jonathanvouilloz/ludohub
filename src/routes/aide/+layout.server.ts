import { requireSessionContext } from '$lib/server/ludo-context.js'
import { getBadgeCount } from '$lib/server/services/notifications.js'
import type { LayoutServerLoad } from './$types'

// L'aide est globale (même contenu pour toutes les ludos). Comme `/reseau/*`,
// l'identité est résolue via la session, pas via un slug dans l'URL.
export const load: LayoutServerLoad = async (event) => {
  const { ludo, member } = await requireSessionContext(event)
  const notifCount = await getBadgeCount(ludo.id, member.id)
  return { ludo, currentMember: member, notifCount }
}
