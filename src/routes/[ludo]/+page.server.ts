import { getDashboardData } from '$lib/server/services/dashboard.js'
import { listProblematicItems } from '$lib/server/services/installations.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember, notifCount } = await parent()
  const problematicItems = await listProblematicItems(ludo.id)
  const dashboard = await getDashboardData(ludo, currentMember, notifCount, problematicItems.length)
  return { dashboard, problematicItems, canManage: isResponsable(currentMember) }
}
