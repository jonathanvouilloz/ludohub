import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { exchangeDeviceToken } from '$lib/server/services/extension-auth.js'
import { extensionError, extensionHeaders, readExtensionJson } from '$lib/server/extension-http.js'

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
    return json(await exchangeDeviceToken(await readExtensionJson(request)), { headers })
  } catch (error) {
    return extensionError(error, headers)
  }
}
