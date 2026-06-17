import { fail } from '@sveltejs/kit'
import { getMembersByLudo } from '$lib/server/db/members.js'
import {
  createMember,
  deactivateMember,
  deleteMember,
  MemberServiceError,
  reactivateMember,
  updateMember,
} from '$lib/server/services/members.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  const members = await getMembersByLudo(ludo.id)
  return { members }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof MemberServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(() =>
      createMember(ludo.id, {
        name: String(data.get('name') ?? ''),
        role: String(data.get('role') ?? 'member'),
      }),
    )
  },

  update: async (event) => {
    const { ludo, member } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(() =>
      updateMember(id, ludo.id, member.id, {
        name: String(data.get('name') ?? ''),
        role: String(data.get('role') ?? 'member'),
      }),
    )
  },

  deactivate: async (event) => {
    const { ludo, member } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(() => deactivateMember(id, ludo.id, member.id))
  },

  reactivate: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(() => reactivateMember(id, ludo.id))
  },

  delete: async (event) => {
    const { ludo, member } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(() => deleteMember(id, ludo.id, member.id))
  },
}
