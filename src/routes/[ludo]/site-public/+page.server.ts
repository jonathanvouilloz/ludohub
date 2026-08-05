import { fail } from '@sveltejs/kit'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import {
  getPublicSiteState,
  PublicSiteServiceError,
  setPublicSiteEnabled,
} from '$lib/server/services/public-site.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import type { Actions } from './$types'

export const actions: Actions = {
  toggle: async (event) => {
    const { ludo, member } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const enabled = data.get('enabled') === 'true'

    try {
      const previous = await getPublicSiteState(ludo.id)
      const settings = await setPublicSiteEnabled(ludo.id, enabled)
      if (previous.enabled !== settings.enabled) {
        await emitAuditEvent({
          action: settings.enabled ? 'public_site.enabled' : 'public_site.disabled',
          actorLudoId: ludo.id,
          actorMemberId: member.id,
          entityType: 'public_site_settings',
          entityId: settings.id,
          metadata: { fromEnabled: previous.enabled, toEnabled: settings.enabled },
        })
      }
      return { success: true, enabled }
    } catch (cause) {
      if (cause instanceof PublicSiteServiceError) {
        return fail(400, { error: cause.message })
      }
      throw cause
    }
  },
}
