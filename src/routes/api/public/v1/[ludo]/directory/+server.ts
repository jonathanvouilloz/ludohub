import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PUBLIC_CACHE_CONTROL, publicCorsHeaders } from '$lib/server/public-http.js'
import { getPublicDirectoryByLudoSlug } from '$lib/server/services/public-api.js'
export const GET: RequestHandler = async ({ params, request, url }) => {
  const cors = publicCorsHeaders(request)
  if (!cors) return json({ error: 'Origin not allowed' }, { status: 403 })
  const raw = url.searchParams.get('limit'),
    limit = raw === null ? 100 : Number(raw)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)
    return json({ error: 'Invalid limit' }, { status: 400, headers: cors })
  const payload = await getPublicDirectoryByLudoSlug(params.ludo, limit)
  if (!payload) {
    cors.set('Cache-Control', 'no-store')
    return json({ error: 'Not found' }, { status: 404, headers: cors })
  }
  cors.set('Cache-Control', PUBLIC_CACHE_CONTROL)
  return json({ version: 1, data: payload }, { headers: cors })
}
export const OPTIONS: RequestHandler = async ({ request }) => {
  const cors = publicCorsHeaders(request)
  return cors
    ? new Response(null, { status: 204, headers: cors })
    : new Response(null, { status: 403 })
}
