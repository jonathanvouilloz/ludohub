import { fail } from '@sveltejs/kit'
import {
  archiveType,
  createType,
  deleteType,
  EventTypeServiceError,
  listTypes,
  renameType,
} from '$lib/server/services/eventTypes.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  const eventTypes = await listTypes(ludo.id)
  return { eventTypes }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof EventTypeServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => createType(ludo.id, { name: String(data.get('name') ?? '') }))
  },

  rename: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      renameType(String(data.get('id') ?? ''), ludo.id, { name: String(data.get('name') ?? '') }),
    )
  },

  archive: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      archiveType(String(data.get('id') ?? ''), ludo.id, data.get('archived') === 'true'),
    )
  },

  delete: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => deleteType(String(data.get('id') ?? ''), ludo.id))
  },
}
