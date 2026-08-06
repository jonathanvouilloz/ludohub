import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  extensionError,
  extensionHeaders,
  readExtensionJson,
  requireExtensionPrincipal,
} from '$lib/server/extension-http.js'
import {
  FamilyRegistrationServiceError,
  processFamilySubmission,
} from '$lib/server/services/family-registrations.js'
import { extensionFamilySubmissionDto } from '$lib/server/extension-family-dto.js'

export const OPTIONS: RequestHandler = ({ request }) => {
  const headers = extensionHeaders(request, 'PATCH')
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 })
}
export const PATCH: RequestHandler = async ({ request, params }) => {
  const headers = extensionHeaders(request, 'PATCH')
  if (!headers) return json({ error: 'origin_not_allowed' }, { status: 403 })
  try {
    const principal = await requireExtensionPrincipal(request)
    const body = await readExtensionJson(request)
    return json(
      {
        submission: extensionFamilySubmissionDto(
          await processFamilySubmission(
            params.id,
            principal.ludoId,
            principal.memberId,
            body.expectedRevision,
          ),
        ),
      },
      { headers },
    )
  } catch (error) {
    if (error instanceof FamilyRegistrationServiceError)
      return json(
        {
          error:
            error.code === 'conflict'
              ? 'conflict'
              : error.code === 'not_found'
                ? 'not_found'
                : 'invalid_request',
        },
        {
          status: error.code === 'conflict' ? 409 : error.code === 'not_found' ? 404 : 400,
          headers,
        },
      )
    return extensionError(error, headers)
  }
}
