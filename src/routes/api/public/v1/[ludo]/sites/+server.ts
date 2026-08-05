import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PUBLIC_CACHE_CONTROL, publicCorsHeaders } from '$lib/server/public-http.js'
import { getPublicSitesByLudoSlug } from '$lib/server/services/public-api.js'

export const GET: RequestHandler = async ({ params, request }) => {
  const cors = publicCorsHeaders(request)
  if (!cors) return json({ error: 'Origin not allowed' }, { status: 403 })

  const payload = await getPublicSitesByLudoSlug(params.ludo)
  if (!payload) {
    cors.set('Cache-Control', 'no-store')
    return json({ error: 'Not found' }, { status: 404, headers: cors })
  }

  cors.set('Cache-Control', PUBLIC_CACHE_CONTROL)
  return json({ version: 1, data: payload }, { headers: cors })
}

export const OPTIONS: RequestHandler = async ({ request }) => {
  const cors = publicCorsHeaders(request)
  if (!cors) return new Response(null, { status: 403 })
  return new Response(null, { status: 204, headers: cors })
}
