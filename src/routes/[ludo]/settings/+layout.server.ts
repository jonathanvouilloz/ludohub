import { error } from '@sveltejs/kit'
import { isResponsable } from '$lib/utils/permissions.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!isResponsable(locals.currentMember)) {
    throw error(403, 'Accès réservé au responsable')
  }
  return {}
}
