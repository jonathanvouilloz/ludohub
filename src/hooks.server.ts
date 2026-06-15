import { auth } from '$lib/server/auth.js'
import { readLudoSession } from '$lib/server/services/auth.js'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  // Déléguer les routes /api/auth/* à Better Auth (réservé super-admin futur)
  if (event.url.pathname.startsWith('/api/auth')) {
    return auth.handler(event.request)
  }

  // Lire la session ludo (cookie signé) et l'attacher aux locals
  event.locals.ludoSession = await readLudoSession(event.cookies)

  return resolve(event)
}
