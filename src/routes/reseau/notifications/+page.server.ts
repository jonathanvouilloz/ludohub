import { fail, redirect } from '@sveltejs/kit'
import { requireSessionContext } from '$lib/server/ludo-context.js'
import {
  getInbox,
  read,
  readAll,
  NotificationServiceError,
} from '$lib/server/services/notifications.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo, currentMember } = await parent()
  const groups = await getInbox(ludo.id, currentMember.id)
  return { groups }
}

/** N'autorise que les chemins internes (évite tout open-redirect via champ caché). */
function safePath(value: string): string | null {
  return value.startsWith('/') && !value.startsWith('//') ? value : null
}

export const actions: Actions = {
  read: async (event) => {
    const { ludo, member } = await requireSessionContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    try {
      await read(id, ludo.id, member.id)
    } catch (err) {
      if (err instanceof NotificationServiceError) return fail(400, { error: err.message })
      throw err
    }
    const target = safePath(String(data.get('href') ?? ''))
    if (target) redirect(303, target)
    return { success: true }
  },

  readAll: async (event) => {
    const { ludo, member } = await requireSessionContext(event)
    await readAll(ludo.id, member.id)
    return { success: true }
  },
}
