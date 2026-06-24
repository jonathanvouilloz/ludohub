import { error } from '@sveltejs/kit'
import { getCampaignById } from '$lib/server/db/newsletter.js'
import { getCampaignStats } from '$lib/server/services/newsletter.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
  const { ludo } = await parent()
  const campaign = await getCampaignById(params.id, ludo.id)
  if (!campaign) throw error(404, 'Campagne introuvable')
  const stats = await getCampaignStats(params.id, ludo.id)
  return { campaign, stats }
}
