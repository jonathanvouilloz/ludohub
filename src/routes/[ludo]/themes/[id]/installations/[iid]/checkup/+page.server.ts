import { error, fail, redirect } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import {
  closeInstallationWithCheckup,
  getInstallationForLudo,
  recordCheckup,
  InstallationServiceError,
} from '$lib/server/services/installations.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent, url }) => {
  const { ludo } = await parent()
  const installation = await getInstallationForLudo(params.iid, ludo.id).catch(() => null)
  if (!installation || installation.themeId !== params.id) {
    throw error(404, 'Installation introuvable')
  }
  if (installation.status !== 'en_cours') {
    throw redirect(303, `/${ludo.slug}/themes/${params.id}/installations/${params.iid}`)
  }
  return { installation, closing: url.searchParams.get('close') === '1' }
}

/** Parse les colonnes parallèles checkupItemId / checkupStatus du formulaire. */
function parseStatuses(data: FormData) {
  const itemIds = data.getAll('checkupItemId').map(String)
  const itemStatuses = data.getAll('checkupStatus').map(String)
  return itemIds.map((installationItemId, i) => {
    const raw = itemStatuses[i]
    const status = raw === 'manquant' ? 'manquant' : raw === 'a_reparer' ? 'a_reparer' : 'present'
    return { installationItemId, status: status as 'present' | 'a_reparer' | 'manquant' }
  })
}

export const actions: Actions = {
  recordCheckup: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    const statuses = parseStatuses(data)
    try {
      await recordCheckup(
        event.params.iid,
        ludo.id,
        member.id,
        statuses,
        String(data.get('notes') ?? ''),
      )
    } catch (err) {
      if (err instanceof InstallationServiceError) {
        return fail(400, { error: err.message })
      }
      throw err
    }
    throw redirect(303, `/${ludo.slug}/themes/${event.params.id}/installations/${event.params.iid}`)
  },

  // Check-up final : enregistre l'état, le reporte sur le thème, puis clôture.
  closeWithCheckup: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    const statuses = parseStatuses(data)
    try {
      await closeInstallationWithCheckup(
        event.params.iid,
        ludo.id,
        member.id,
        statuses,
        String(data.get('notes') ?? ''),
      )
    } catch (err) {
      if (err instanceof InstallationServiceError) {
        return fail(400, { error: err.message })
      }
      throw err
    }
    // Installation clôturée → retour à la fiche thème (liste de référence mise à jour).
    throw redirect(303, `/${ludo.slug}/themes/${event.params.id}`)
  },
}
