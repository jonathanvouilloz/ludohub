import { getGlobalActivityLog, listLudotheques } from '$lib/server/services/admin.js'
import type { PageServerLoad } from './$types'

const LIMIT = 200

export const load: PageServerLoad = async ({ url }) => {
  const ludoId = url.searchParams.get('ludoId') || undefined
  const action = url.searchParams.get('action')?.trim() || undefined

  const [logs, ludos] = await Promise.all([
    getGlobalActivityLog({ ludoId, action, limit: LIMIT }),
    listLudotheques(),
  ])

  return { logs, ludos, filters: { ludoId: ludoId ?? '', action: action ?? '' } }
}
