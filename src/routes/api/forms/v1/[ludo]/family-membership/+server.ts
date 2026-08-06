import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { publicCorsHeaders } from '$lib/server/public-http.js'
import { FamilyRegistrationServiceError, getPublicFamilyMembershipByLudoSlug } from '$lib/server/services/family-registrations.js'

function headers(request: Request) {
  const value = publicCorsHeaders(request)
  if (!value) return null
  value.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  value.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return value
}

export const GET: RequestHandler = async ({ params, request }) => {
  const responseHeaders = headers(request)
  if (!responseHeaders) return json({ error: 'Origin not allowed' }, { status: 403 })
  try {
    return json(await getPublicFamilyMembershipByLudoSlug(params.ludo), { headers: responseHeaders })
  } catch (error) {
    if (error instanceof FamilyRegistrationServiceError && error.code === 'not_found')
      return json({ error: 'Not found' }, { status: 404, headers: responseHeaders })
    throw error
  }
}

export const OPTIONS: RequestHandler = async ({ request }) => {
  const responseHeaders = headers(request)
  return responseHeaders ? new Response(null, { status: 204, headers: responseHeaders }) : new Response(null, { status: 403 })
}
