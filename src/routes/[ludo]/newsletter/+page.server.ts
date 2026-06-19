import { fail, redirect } from '@sveltejs/kit'
import { countSubscribed, listCampaigns } from '$lib/server/db/newsletter.js'
import {
  createDraftCampaign,
  NewsletterServiceError,
  removeCampaign,
} from '$lib/server/services/newsletter.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  const [campaigns, subscriberCount] = await Promise.all([
    listCampaigns(ludo.id),
    countSubscribed(ludo.id),
  ])
  return { campaigns, subscriberCount }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const campaign = await createDraftCampaign(ludo.id)
    throw redirect(303, `/${ludo.slug}/newsletter/${campaign.id}`)
  },

  delete: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    try {
      await removeCampaign(String(data.get('id') ?? ''), ludo.id)
      return { success: true }
    } catch (err) {
      if (err instanceof NewsletterServiceError) return fail(400, { error: err.message })
      throw err
    }
  },
}
