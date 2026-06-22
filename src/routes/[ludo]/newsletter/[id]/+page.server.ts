import { error, fail } from '@sveltejs/kit'
import { countSubscribedByTag, getCampaignById } from '$lib/server/db/newsletter.js'
import {
  NewsletterServiceError,
  parseContentField,
  saveDraft,
  sendCampaign,
  sendTestEmail,
  type CampaignDraft,
} from '$lib/server/services/newsletter.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
  const { ludo } = await parent()
  const campaign = await getCampaignById(params.id, ludo.id)
  if (!campaign) throw error(404, 'Campagne introuvable')
  const subscribedByTag = await countSubscribedByTag(ludo.id)
  return { campaign, subscribedByTag }
}

function draftFrom(data: FormData): CampaignDraft {
  return {
    subject: String(data.get('subject') ?? ''),
    previewText: String(data.get('previewText') ?? ''),
    content: parseContentField(String(data.get('content') ?? '')),
    targetTag: String(data.get('targetTag') ?? ''),
  }
}

export const actions: Actions = {
  save: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    try {
      await saveDraft(event.params.id, ludo.id, draftFrom(data))
      return { success: true }
    } catch (err) {
      if (err instanceof NewsletterServiceError) return fail(400, { error: err.message })
      throw err
    }
  },

  sendTest: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    try {
      await sendTestEmail(
        ludo,
        draftFrom(data),
        String(data.get('testEmail') ?? ''),
        event.url.origin,
      )
      return { success: true }
    } catch (err) {
      if (err instanceof NewsletterServiceError) return fail(400, { error: err.message })
      throw err
    }
  },

  send: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    try {
      // Persiste la dernière version avant l'envoi (la campagne devient la source).
      await saveDraft(event.params.id, ludo.id, draftFrom(data))
      const res = await sendCampaign(event.params.id, ludo, event.url.origin)
      return { success: true, sent: res.sent, failed: res.failed }
    } catch (err) {
      if (err instanceof NewsletterServiceError) return fail(400, { error: err.message })
      throw err
    }
  },
}
