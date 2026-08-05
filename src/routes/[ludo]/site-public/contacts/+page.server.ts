import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import {
  listPublicContactsForManagement,
  PublicContactServiceError,
  transitionPublicContact,
} from '$lib/server/services/public-contacts.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import type { Actions, PageServerLoad } from './$types'

async function context(event: RequestEvent) {
  const value = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(value.ludo.id))) throw error(404, 'Module indisponible')
  return value
}
function revision(data: FormData) {
  const value = Number(data.get('revision'))
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PublicContactServiceError('Révision invalide.')
  return value
}
async function run(callback: () => Promise<unknown>) {
  try {
    return await callback()
  } catch (cause) {
    if (cause instanceof PublicContactServiceError || cause instanceof PublicSiteServiceError)
      return fail(
        cause instanceof PublicContactServiceError && cause.code === 'conflict' ? 409 : 400,
        {
          error: cause.message,
        },
      )
    throw cause
  }
}
export const load: PageServerLoad = async (event) => {
  const { ludo } = await context(event)
  return { messages: await listPublicContactsForManagement(ludo.id, undefined) }
}
export const actions: Actions = {
  transition: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const status = data.get('status')
      if (status !== 'processed' && status !== 'archived')
        throw new PublicContactServiceError('Transition invalide.')
      const result = await transitionPublicContact(id, ludo.id, status, member.id, revision(data))
      if (result.changed)
        await emitAuditEvent({
          action: status === 'processed' ? 'public_contact.processed' : 'public_contact.archived',
          actorLudoId: ludo.id,
          actorMemberId: member.id,
          entityType: 'public_contact',
          entityId: result.message.id,
          metadata: { toStatus: result.message.status },
        })
      return { success: true }
    })
  },
}
