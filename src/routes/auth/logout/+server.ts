import { redirect } from '@sveltejs/kit'
import { getLudoById } from '$lib/server/db/ludotheques.js'
import { clearLudoSession } from '$lib/server/services/auth.js'
import type { RequestHandler } from './$types'

/**
 * Déconnexion : efface le cookie de session et redirige vers la page de login
 * de la ludo courante (slug résolu via la session). Partagé par le shell des
 * routes `[ludo]/*` et `reseau/*` — rien à passer côté formulaire.
 */
export const POST: RequestHandler = async ({ locals, cookies }) => {
  const session = locals.ludoSession
  let target = '/'

  if (session) {
    const ludo = await getLudoById(session.ludoId)
    if (ludo) target = `/auth/${ludo.slug}`
  }

  clearLudoSession(cookies)
  throw redirect(303, target)
}
