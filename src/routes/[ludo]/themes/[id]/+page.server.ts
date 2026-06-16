import { error, fail } from '@sveltejs/kit'
import { getOtherLudos } from '$lib/server/db/ludotheques.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import {
  addItem,
  archiveTheme,
  editTheme,
  getThemeDetail,
  removeItem,
  setThemeShareable,
  ThemeServiceError,
} from '$lib/server/services/themes.js'
import {
  confirmLoanRequest,
  declineLoanRequest,
  loanTheme,
  returnTheme,
  LoanServiceError,
} from '$lib/server/services/loans.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
  const { ludo } = await parent()
  const theme = await getThemeDetail(params.id, ludo.id).catch(() => null)
  if (!theme) throw error(404, 'Thème introuvable')

  const ludos = await getOtherLudos(ludo.id)
  return { theme, ludos: ludos.map((l) => ({ id: l.id, name: l.name })) }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof ThemeServiceError || err instanceof LoanServiceError) {
      return fail(400, { error: err.message })
    }
    throw err
  }
}

export const actions: Actions = {
  update: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      editTheme(event.params.id as string, ludo.id, {
        name: String(data.get('name') ?? ''),
        description: String(data.get('description') ?? ''),
      }),
    )
  },

  toggleShareable: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      setThemeShareable(event.params.id as string, ludo.id, data.get('shareable') === 'true'),
    )
  },

  archive: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      archiveTheme(event.params.id as string, ludo.id, data.get('archived') === 'true'),
    )
  },

  addItem: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      addItem(event.params.id as string, ludo.id, {
        name: String(data.get('name') ?? ''),
        quantity: String(data.get('quantity') ?? '1'),
      }),
    )
  },

  removeItem: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => removeItem(String(data.get('itemId') ?? ''), ludo.id))
  },

  loan: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() =>
      loanTheme(
        event.params.id as string,
        ludo.id,
        String(data.get('toLudoId') ?? ''),
        String(data.get('notes') ?? ''),
      ),
    )
  },

  returnLoan: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => returnTheme(String(data.get('loanId') ?? ''), ludo.id))
  },

  confirmRequest: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => confirmLoanRequest(String(data.get('loanId') ?? ''), ludo.id))
  },

  declineRequest: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => declineLoanRequest(String(data.get('loanId') ?? ''), ludo.id))
  },
}
