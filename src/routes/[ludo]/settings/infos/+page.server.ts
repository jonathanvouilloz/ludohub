import { fail } from '@sveltejs/kit'
import { LudothequeServiceError, updateLudoInfo } from '$lib/server/services/ludotheque.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  return { ludo }
}

export const actions: Actions = {
  update: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    try {
      await updateLudoInfo(ludo.id, {
        name: String(data.get('name') ?? ''),
        color: String(data.get('color') ?? ''),
        responsible: String(data.get('responsible') ?? ''),
        address: String(data.get('address') ?? ''),
        phone: String(data.get('phone') ?? ''),
        email: String(data.get('email') ?? ''),
        website: String(data.get('website') ?? ''),
      })
      return { success: true }
    } catch (err) {
      if (err instanceof LudothequeServiceError) return fail(400, { error: err.message })
      throw err
    }
  },
}
