import { error, fail } from '@sveltejs/kit'
import { getMembersByLudo } from '$lib/server/db/members.js'
import {
  createMember,
  deactivateMember,
  deleteMember,
  MemberServiceError,
  reactivateMember,
  updateMember,
} from '$lib/server/services/members.js'
import { isResponsable } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const ludo = locals.ludo
  if (!ludo) throw error(403, 'Accès réservé au responsable')

  const members = await getMembersByLudo(ludo.id)
  return { members }
}

/** Garde commun à toutes les actions : retourne le contexte ludo/membre ou throw 403. */
function requireContext(locals: App.Locals) {
  if (!isResponsable(locals.currentMember) || !locals.ludo || !locals.currentMember) {
    throw error(403, 'Accès refusé')
  }
  return { ludo: locals.ludo, currentMember: locals.currentMember }
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
  create: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    return run(() =>
      createMember(ludo.id, {
        name: String(data.get('name') ?? ''),
        role: String(data.get('role') ?? 'member'),
      }),
    )
  },

  update: async ({ request, locals }) => {
    const { ludo, currentMember } = requireContext(locals)
    const data = await request.formData()
    const id = String(data.get('id') ?? '')
    return run(() =>
      updateMember(id, ludo.id, currentMember.id, {
        name: String(data.get('name') ?? ''),
        role: String(data.get('role') ?? 'member'),
      }),
    )
  },

  deactivate: async ({ request, locals }) => {
    const { ludo, currentMember } = requireContext(locals)
    const data = await request.formData()
    const id = String(data.get('id') ?? '')
    return run(() => deactivateMember(id, ludo.id, currentMember.id))
  },

  reactivate: async ({ request, locals }) => {
    const { ludo } = requireContext(locals)
    const data = await request.formData()
    const id = String(data.get('id') ?? '')
    return run(() => reactivateMember(id, ludo.id))
  },

  delete: async ({ request, locals }) => {
    const { ludo, currentMember } = requireContext(locals)
    const data = await request.formData()
    const id = String(data.get('id') ?? '')
    return run(() => deleteMember(id, ludo.id, currentMember.id))
  },
}
