import { requireSessionContext } from '$lib/server/ludo-context.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async (event) => {
  const { ludo, member } = await requireSessionContext(event)
  return { ludo, currentMember: member }
}
