import { fail } from '@sveltejs/kit'
import { getContactByToken, setContactStatusByToken } from '$lib/server/db/newsletter.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ url }) => {
  const token = url.searchParams.get('token')
  if (!token) return { state: 'invalid' as const }
  const contact = await getContactByToken(token)
  if (!contact) return { state: 'invalid' as const }
  return {
    state: contact.status === 'unsubscribed' ? ('done' as const) : ('confirm' as const),
    email: contact.email,
  }
}

export const actions: Actions = {
  // `default` couvre à la fois le clic « Confirmer » et le one-click List-Unsubscribe-Post
  // (POST direct sur l'URL avec ?token=…) émis par Gmail/Yahoo.
  default: async ({ url }) => {
    const token = url.searchParams.get('token')
    if (!token) return fail(400, { error: 'Lien de désabonnement invalide.' })
    const contact = await setContactStatusByToken(token, 'unsubscribed')
    if (!contact) return fail(400, { error: 'Lien de désabonnement invalide.' })
    return { success: true }
  },
}
