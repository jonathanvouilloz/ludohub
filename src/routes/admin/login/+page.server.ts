import { fail, redirect } from '@sveltejs/kit'
import { verifyAdminPassword, setAdminSessionCookie } from '$lib/server/services/admin-auth.js'
import { checkRateLimit } from '$lib/server/services/rate-limit.js'
import type { Actions, PageServerLoad } from './$types'

const GENERIC_ERROR = 'Mot de passe incorrect'
const RATE_LIMITED = 'Trop de tentatives. Réessayez dans quelques minutes.'

export const load: PageServerLoad = async ({ locals }) => {
  // Déjà authentifié → dashboard admin
  if (locals.adminSession) throw redirect(303, '/admin')
  return {}
}

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    // 8 essais / 15 min par IP : un seul mot de passe global garde tout l'admin.
    const limit = checkRateLimit(`admin-login:${getClientAddress()}`, 8, 15 * 60 * 1000)
    if (!limit.ok) return fail(429, { error: RATE_LIMITED })

    const data = await request.formData()
    const password = String(data.get('password') ?? '')

    if (!(await verifyAdminPassword(password))) {
      return fail(401, { error: GENERIC_ERROR })
    }

    await setAdminSessionCookie(cookies)
    throw redirect(303, '/admin')
  },
}
