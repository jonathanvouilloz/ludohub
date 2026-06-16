import { fail } from '@sveltejs/kit'
import { requireSessionContext } from '$lib/server/ludo-context.js'
import { getNetworkThemes } from '$lib/server/services/themes.js'
import { requestTheme, LoanServiceError } from '$lib/server/services/loans.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { ludo } = await parent()
  const networkThemes = await getNetworkThemes(ludo.id)

  // Annotation par thème : statut de la demande de la ludo courante + prêt actif.
  const themes = networkThemes.map((theme) => {
    const loans = theme.loans ?? []
    const onLoan = loans.some((l) => l.status === 'actif')
    const mine = loans.find(
      (l) => l.toLudoId === ludo.id && (l.status === 'en_attente' || l.status === 'actif'),
    )
    return { ...theme, onLoan, myRequestStatus: mine?.status ?? null }
  })

  return { themes }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof LoanServiceError) return fail(400, { error: err.message })
    throw err
  }
}

export const actions: Actions = {
  request: async (event) => {
    const { ludo } = await requireSessionContext(event)
    const data = await event.request.formData()
    return run(() =>
      requestTheme(String(data.get('themeId') ?? ''), ludo.id, String(data.get('notes') ?? '')),
    )
  },
}
