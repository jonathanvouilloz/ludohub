import { fail } from '@sveltejs/kit'
import { listContacts } from '$lib/server/db/newsletter.js'
import {
  addContact,
  editContact,
  NewsletterServiceError,
  removeContact,
} from '$lib/server/services/newsletter.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  const contacts = await listContacts(ludo.id)
  return { contacts }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof NewsletterServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      addContact(ludo.id, {
        email: String(data.get('email') ?? ''),
        firstName: String(data.get('firstName') ?? ''),
        lastName: String(data.get('lastName') ?? ''),
        notes: String(data.get('notes') ?? ''),
      }),
    )
  },

  update: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      editContact(String(data.get('id') ?? ''), ludo.id, {
        email: String(data.get('email') ?? ''),
        firstName: String(data.get('firstName') ?? ''),
        lastName: String(data.get('lastName') ?? ''),
        notes: String(data.get('notes') ?? ''),
        status: String(data.get('status') ?? ''),
      }),
    )
  },

  delete: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => removeContact(String(data.get('id') ?? ''), ludo.id))
  },
}
