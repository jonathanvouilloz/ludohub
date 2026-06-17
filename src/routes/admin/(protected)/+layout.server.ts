import { requireAdminContext } from '$lib/server/admin-context.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = (event) => {
  requireAdminContext(event)
  return {}
}
