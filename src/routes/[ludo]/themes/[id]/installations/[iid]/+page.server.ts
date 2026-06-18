import { error, fail } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import {
  getInstallationForLudo,
  resolveInstallationItemForLudo,
  InstallationServiceError,
  type ItemResolution,
} from '$lib/server/services/installations.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
  const { ludo } = await parent()
  const installation = await getInstallationForLudo(params.iid, ludo.id).catch(() => null)
  if (!installation || installation.themeId !== params.id) {
    throw error(404, 'Installation introuvable')
  }
  return { installation }
}

export const actions: Actions = {
  // Résout un objet (réparé / retrouvé / perdu), à tout moment hors check-up.
  resolveItem: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    const itemId = String(data.get('itemId') ?? '')
    const raw = String(data.get('resolution') ?? '')
    if (raw !== 'repaired' && raw !== 'found' && raw !== 'lost') {
      return fail(400, { error: 'Résolution invalide.' })
    }
    try {
      await resolveInstallationItemForLudo(event.params.iid, itemId, ludo.id, raw as ItemResolution)
      return { success: true }
    } catch (err) {
      if (err instanceof InstallationServiceError) {
        return fail(400, { error: err.message })
      }
      throw err
    }
  },
}
