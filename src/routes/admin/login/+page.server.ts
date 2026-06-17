import { fail, redirect } from '@sveltejs/kit'
import { verifyAdminPassword, setAdminSessionCookie } from '$lib/server/services/admin-auth.js'
import type { Actions, PageServerLoad } from './$types'

const GENERIC_ERROR = 'Mot de passe incorrect'

export const load: PageServerLoad = async ({ locals }) => {
  // Déjà authentifié → dashboard admin
  if (locals.adminSession) throw redirect(303, '/admin')
  return {}
}

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData()
    const password = String(data.get('password') ?? '')

    if (!(await verifyAdminPassword(password))) {
      return fail(401, { error: GENERIC_ERROR })
    }

    await setAdminSessionCookie(cookies)
    throw redirect(303, '/admin')
  },
}
