import { fail } from '@sveltejs/kit'
import {
  createGameWish,
  deleteGameWish,
  listGameWishes,
  setBought,
  setWanted,
  WishServiceError,
} from '$lib/server/services/wishes.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  const wishes = await listGameWishes(ludo.id)
  return { wishes }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof WishServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  // Tout membre actif peut gérer la wishlist.
  add: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      createGameWish(ludo.id, {
        title: String(data.get('title') ?? ''),
        link: String(data.get('link') ?? ''),
        priceChf: String(data.get('priceChf') ?? ''),
      }),
    )
  },

  markBought: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => setBought(String(data.get('id') ?? ''), ludo.id, member.id))
  },

  markWanted: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => setWanted(String(data.get('id') ?? ''), ludo.id))
  },

  delete: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => deleteGameWish(String(data.get('id') ?? ''), ludo.id))
  },
}
