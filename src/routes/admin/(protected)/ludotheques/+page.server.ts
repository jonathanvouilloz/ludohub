import { fail } from '@sveltejs/kit'
import { requireAdminContext } from '$lib/server/admin-context.js'
import { AdminServiceError, createLudotheque, listLudotheques } from '$lib/server/services/admin.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const ludos = await listLudotheques()
  return { ludos }
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
  create: async (event) => {
    // Garde : les form actions ne déclenchent PAS le `load` du layout (protected),
    // donc le contexte admin doit être re-vérifié ici, sinon l'action est ouverte.
    requireAdminContext(event)
    const data = await event.request.formData()
    return run(() =>
      createLudotheque({
        name: String(data.get('name') ?? ''),
        // Slug optionnel : le service le dérive du nom si laissé vide.
        slug: String(data.get('slug') ?? ''),
        color: String(data.get('color') ?? ''),
        password: String(data.get('password') ?? ''),
        address: String(data.get('address') ?? ''),
      }),
    )
  },
}
