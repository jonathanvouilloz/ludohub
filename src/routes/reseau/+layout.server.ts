import { requireSessionContext } from '$lib/server/ludo-context.js'
import { getBadgeCount } from '$lib/server/services/notifications.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async (event) => {
  const { ludo, member } = await requireSessionContext(event)
  const notifCount = await getBadgeCount(ludo.id, member.id)
  return { ludo, currentMember: member, notifCount }
}
