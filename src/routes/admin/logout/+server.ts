import { redirect } from '@sveltejs/kit'
import { clearAdminSession } from '$lib/server/services/admin-auth.js'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = ({ cookies }) => {
  clearAdminSession(cookies)
  throw redirect(303, '/admin/login')
}
