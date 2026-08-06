import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  extensionError,
  extensionHeaders,
  requireExtensionPrincipal,
} from '$lib/server/extension-http.js'
import { listFamilySubmissions } from '$lib/server/services/family-registrations.js'
import type { FamilyRegistrationSubmissionStatus } from '$lib/server/schema.js'

export const OPTIONS: RequestHandler = ({ request }) => {
  const headers = extensionHeaders(request, 'GET')
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 })
}
export const GET: RequestHandler = async ({ request, url }) => {
  const headers = extensionHeaders(request, 'GET')
  if (!headers) return json({ error: 'origin_not_allowed' }, { status: 403 })
  const status = url.searchParams.get('status')
  if (status && status !== 'new' && status !== 'processed')
    return json({ error: 'invalid_request' }, { status: 400, headers })
  const rawLimit = url.searchParams.get('limit') ?? '100'
  if (!/^\d{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 200)
    return json({ error: 'invalid_request' }, { status: 400, headers })
  try {
    const principal = await requireExtensionPrincipal(request)
    const rows = await listFamilySubmissions(
      principal.ludoId,
      (status ?? undefined) as FamilyRegistrationSubmissionStatus | undefined,
      Number(rawLimit),
    )
    return json(
      {
        submissions: rows.map((row) => ({
          id: row.id,
          site: { slug: row.siteSlug, name: row.siteName },
          submittedAt: row.createdAt,
          responsible: { firstName: row.firstName, lastName: row.lastName, email: row.email },
          status: row.status,
          payment: { method: row.paymentMethod, recordedAt: row.paymentRecordedAt },
          revision: row.revision,
          processedAt: row.processedAt,
        })),
      },
      { headers },
    )
  } catch (error) {
    return extensionError(error, headers)
  }
}
