import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  extensionError,
  extensionHeaders,
  requireExtensionPrincipal,
} from '$lib/server/extension-http.js'
import {
  FamilyRegistrationServiceError,
  getFamilySubmission,
} from '$lib/server/services/family-registrations.js'
import { extensionFamilySubmissionDto } from '$lib/server/extension-family-dto.js'

export const OPTIONS: RequestHandler = ({ request }) => {
  const headers = extensionHeaders(request, 'GET')
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 })
}
export const GET: RequestHandler = async ({ request, params }) => {
  const headers = extensionHeaders(request, 'GET')
  if (!headers) return json({ error: 'origin_not_allowed' }, { status: 403 })
  try {
    const principal = await requireExtensionPrincipal(request)
    const row = await getFamilySubmission(params.id, principal.ludoId)
    return json({ submission: extensionFamilySubmissionDto(row) }, { headers })
  } catch (error) {
    if (error instanceof FamilyRegistrationServiceError)
      return json(
        { error: error.code === 'not_found' ? 'not_found' : 'invalid_request' },
        { status: error.code === 'not_found' ? 404 : 400, headers },
      )
    return extensionError(error, headers)
  }
}
