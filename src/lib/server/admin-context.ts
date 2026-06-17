import { redirect, type RequestEvent } from '@sveltejs/kit'

type Ctx = Pick<RequestEvent, 'locals'>

/**
 * Garde super-admin : exige une session admin valide (cookie signé `ludohub_admin`,
 * posé par `hooks.server.ts`). Renvoie vers `/admin/login` sinon.
 */
export function requireAdminContext(event: Ctx): { admin: true } {
  if (!event.locals.adminSession) {
    throw redirect(303, '/admin/login')
  }
  return { admin: true }
}
