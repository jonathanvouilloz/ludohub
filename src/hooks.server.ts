import { auth } from '$lib/server/auth.js'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  // Déléguer les routes /api/auth/* à Better Auth
  if (event.url.pathname.startsWith('/api/auth')) {
    return auth.handler(event.request)
  }

  // Attacher la session aux locals pour toutes les autres routes
  try {
    const session = await auth.api.getSession({ headers: event.request.headers })
    event.locals.session = session
  } catch {
    event.locals.session = null
  }

  return resolve(event)
}
