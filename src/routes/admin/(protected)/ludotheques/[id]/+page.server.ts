import { error, fail } from '@sveltejs/kit'
import {
  AdminServiceError,
  getLudotheque,
  resetLudoPassword,
  updateLudotheque,
} from '$lib/server/services/admin.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
  try {
    const ludo = await getLudotheque(params.id)
    return { ludo }
  } catch (err) {
    if (err instanceof AdminServiceError) throw error(404, err.message)
    throw err
  }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof AdminServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  update: async ({ params, request }) => {
    const data = await request.formData()
    return run(() =>
      updateLudotheque(params.id, {
        name: String(data.get('name') ?? ''),
        color: String(data.get('color') ?? ''),
        address: String(data.get('address') ?? ''),
      }),
    )
  },

  resetPassword: async ({ params, request }) => {
    const data = await request.formData()
    const password = String(data.get('password') ?? '')
    const confirm = String(data.get('confirm') ?? '')
    if (password !== confirm) {
      return fail(400, { passwordError: 'Les deux mots de passe ne correspondent pas.' })
    }
    try {
      await resetLudoPassword(params.id, password)
      return { passwordSuccess: true }
    } catch (err) {
      if (err instanceof AdminServiceError) return fail(400, { passwordError: err.message })
      throw err
    }
  },
}
