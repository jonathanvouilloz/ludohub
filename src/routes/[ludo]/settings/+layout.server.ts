import { isResponsable } from '$lib/utils/permissions.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ parent }) => {
  const { currentMember } = await parent()
  return { canEditSettings: isResponsable(currentMember) }
}
