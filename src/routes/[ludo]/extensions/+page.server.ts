import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import {
  getExtensionSessions,
  revokeManagedExtensionSession,
} from '$lib/server/services/extension-auth.js'

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireResponsableContext(event)
  return { sessions: await getExtensionSessions(ludo.id) }
}

export const actions: Actions = {
  revoke: async (event) => {
    if (event.request.headers.get('origin') !== event.url.origin)
      return fail(403, { message: 'Origine invalide.' })
    const { ludo, member } = await requireResponsableContext(event)
    const id = (await event.request.formData()).get('id')
    if (typeof id !== 'string') return fail(400, { message: 'Poste invalide.' })
    try {
      await revokeManagedExtensionSession({ id, ludoId: ludo.id, memberId: member.id })
      return { success: true }
    } catch {
      return fail(400, { message: 'Poste introuvable ou déjà révoqué.' })
    }
  },
}
