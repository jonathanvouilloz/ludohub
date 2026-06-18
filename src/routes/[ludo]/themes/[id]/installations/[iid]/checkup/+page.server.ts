import { error, fail, redirect } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import {
  getInstallationForLudo,
  recordCheckup,
  InstallationServiceError,
} from '$lib/server/services/installations.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
  const { ludo } = await parent()
  const installation = await getInstallationForLudo(params.iid, ludo.id).catch(() => null)
  if (!installation || installation.themeId !== params.id) {
    throw error(404, 'Installation introuvable')
  }
  if (installation.status !== 'en_cours') {
    throw redirect(303, `/${ludo.slug}/themes/${params.id}/installations/${params.iid}`)
  }
  return { installation }
}

export const actions: Actions = {
  recordCheckup: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    const itemIds = data.getAll('checkupItemId').map(String)
    const itemStatuses = data.getAll('checkupStatus').map(String)
    const statuses = itemIds.map((installationItemId, i) => {
      const raw = itemStatuses[i]
      const status = raw === 'manquant' ? 'manquant' : raw === 'a_reparer' ? 'a_reparer' : 'present'
      return { installationItemId, status: status as 'present' | 'a_reparer' | 'manquant' }
    })
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
}
