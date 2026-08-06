import { error, fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { resolveSessionContext } from '$lib/server/ludo-context.js'
import { isResponsable } from '$lib/utils/permissions.js'
import {
  approveDeviceAuthorization,
  ExtensionAuthError,
} from '$lib/server/services/extension-auth.js'

export const load: PageServerLoad = async (event) => {
  const context = await resolveSessionContext(event)
  const userCode = event.url.searchParams.get('user_code') ?? ''
  if (!context) return { connected: false as const, userCode, ludoName: null }
  if (!isResponsable(context.member)) throw error(403, 'Accès réservé aux responsables.')
  return { connected: true as const, userCode, ludoName: context.ludo.name }
}

export const actions: Actions = {
  default: async (event) => {
    if (event.request.headers.get('origin') !== event.url.origin)
      return fail(403, { message: 'Origine invalide.' })
    const context = await resolveSessionContext(event)
    if (!context || !isResponsable(context.member))
      return fail(403, { message: 'Session responsable requise.' })
    const form = await event.request.formData()
    try {
      const result = await approveDeviceAuthorization({
        userCode: form.get('userCode'),
        ludoId: context.ludo.id,
        memberId: context.member.id,
        passwordHash: context.ludo.passwordHash,
      })
      return { success: true, clientName: result.clientName }
    } catch (cause) {
      if (cause instanceof ExtensionAuthError)
        return fail(400, { message: 'Code invalide ou expiré.' })
      throw cause
    }
  },
}
