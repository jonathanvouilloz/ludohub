import { fail } from '@sveltejs/kit'
import {
  countContacts,
  countSubscribedByTag,
  listContacts,
  type ContactSortColumn,
} from '$lib/server/db/newsletter.js'
import {
  addContact,
  anonymizeContact,
  editContact,
  NewsletterServiceError,
  removeContact,
  setContactSubscription,
} from '$lib/server/services/newsletter.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

const PAGE_SIZE = 50
const SORT_COLUMNS: ContactSortColumn[] = ['email', 'createdAt', 'status', 'tag']

export const load: PageServerLoad = async ({ parent, url }) => {
  const { ludo } = await parent()

  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const sortParam = url.searchParams.get('sort')
  const col = SORT_COLUMNS.includes(sortParam as ContactSortColumn)
    ? (sortParam as ContactSortColumn)
    : 'createdAt'
  const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

  const [contacts, total, subscribedByTag] = await Promise.all([
    listContacts(ludo.id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, sort: { col, dir } }),
    countContacts(ludo.id),
    countSubscribedByTag(ludo.id),
  ])

  return {
    contacts,
    subscribedByTag,
    total,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    sort: { col, dir },
  }
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
        tag: String(data.get('tag') ?? ''),
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
        tag: String(data.get('tag') ?? ''),
      }),
    )
  },

  toggleSubscription: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      setContactSubscription(
        String(data.get('id') ?? ''),
        ludo.id,
        data.get('subscribed') === 'true',
      ),
    )
  },

  anonymize: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => anonymizeContact(String(data.get('id') ?? ''), ludo.id))
  },

  delete: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() => removeContact(String(data.get('id') ?? ''), ludo.id))
  },
}
