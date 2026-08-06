import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { FamilyRegistrationServiceError, getPublicFamilyMembershipByLudoSlug } from '$lib/server/services/family-registrations.js'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' })
  try { return { config: await getPublicFamilyMembershipByLudoSlug(params.ludo), ludoSlug: params.ludo } }
  catch (cause) { if (cause instanceof FamilyRegistrationServiceError) throw error(404, 'Formulaire introuvable'); throw cause }
}
