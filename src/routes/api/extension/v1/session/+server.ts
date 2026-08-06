import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  extensionError,
  extensionHeaders,
  requireExtensionPrincipal,
} from '$lib/server/extension-http.js'

export const OPTIONS: RequestHandler = ({ request }) => {
  const headers = extensionHeaders(request, 'GET')
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 })
}
export const GET: RequestHandler = async ({ request }) => {
  const headers = extensionHeaders(request, 'GET')
  if (!headers) return json({ error: 'origin_not_allowed' }, { status: 403 })
  try {
    const principal = await requireExtensionPrincipal(request)
    return json(
      {
        authenticated: true,
        session: {
          id: principal.sessionId,
          deviceName: principal.label,
          ludoName: principal.ludoName,
          memberName: principal.memberName,
          scopes: [
            'family-memberships:read',
            'family-memberships:process',
            'family-memberships:payment',
          ],
        },
      },
      { headers },
    )
  } catch (error) {
    return extensionError(error, headers)
  }
}
