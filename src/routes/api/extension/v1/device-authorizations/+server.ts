import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { checkRateLimit } from '$lib/server/services/rate-limit.js'
import { createDeviceAuthorization } from '$lib/server/services/extension-auth.js'
import { extensionError, extensionHeaders, readExtensionJson } from '$lib/server/extension-http.js'

export const OPTIONS: RequestHandler = ({ request }) => {
  const headers = extensionHeaders(request, 'POST')
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 })
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const headers = extensionHeaders(request, 'POST')
  if (!headers) return json({ error: 'origin_not_allowed' }, { status: 403 })
  const rate = checkRateLimit(`extension-device:${getClientAddress()}`, 10, 60_000)
  if (!rate.ok) {
    headers.set('Retry-After', String(rate.retryAfter))
    return json({ error: 'slow_down' }, { status: 429, headers })
  }
  try {
    return json(await createDeviceAuthorization(await readExtensionJson(request)), {
      status: 201,
      headers,
    })
  } catch (error) {
    return extensionError(error, headers)
  }
}
