import { requireLudoContext } from '$lib/server/ludo-context.js'
import { getBadgeCount } from '$lib/server/services/notifications.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async (event) => {
  const { ludo, member } = await requireLudoContext(event)

  const [notifCount, publicSiteEnabled] = await Promise.all([
    getBadgeCount(ludo.id, member.id),
    isPublicSiteEnabled(ludo.id),
  ])

  return { ludo, currentMember: member, notifCount, publicSiteEnabled }
}
