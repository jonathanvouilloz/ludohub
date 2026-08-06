import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { bearer, extensionError, extensionHeaders } from '$lib/server/extension-http.js'
import { logoutExtension } from '$lib/server/services/extension-auth.js'

export const OPTIONS: RequestHandler = ({ request }) => {
  const headers = extensionHeaders(request, 'POST')
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 })
}
export const POST: RequestHandler = async ({ request }) => {
  const headers = extensionHeaders(request, 'POST')
  if (!headers) return json({ error: 'origin_not_allowed' }, { status: 403 })
  try {
    await logoutExtension(bearer(request))
    return new Response(null, { status: 204, headers })
  } catch (error) {
    return extensionError(error, headers)
  }
}
