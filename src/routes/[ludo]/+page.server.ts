import { getDashboardData } from '$lib/server/services/dashboard.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember, notifCount } = await parent()
  const dashboard = await getDashboardData(ludo, currentMember, notifCount)
  return { dashboard, canManage: isResponsable(currentMember) }
}
