import { fail, redirect } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { createThemeForLudo, ThemeServiceError } from '$lib/server/services/themes.js'
import type { Actions } from './$types'

export const actions: Actions = {
  create: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()

    const names = data.getAll('itemName').map(String)
    const quantities = data.getAll('itemQuantity').map(String)
    const items = names.map((name, i) => ({ name, quantity: quantities[i] ?? '1' }))

    let theme
    try {
      theme = await createThemeForLudo(
        ludo.id,
        {
          name: String(data.get('name') ?? ''),
          description: String(data.get('description') ?? ''),
          isShareable: data.get('isShareable') === 'on',
        },
        items,
      )
    } catch (err) {
      if (err instanceof ThemeServiceError) return fail(400, { error: err.message })
      throw err
    }

    throw redirect(303, `/${ludo.slug}/themes/${theme.id}`)
  },
}
