import { createHash } from 'node:crypto'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { publicCorsHeaders } from '$lib/server/public-http.js'
import { checkRateLimit } from '$lib/server/services/rate-limit.js'
import {
  PublicActivityRegistrationServiceError,
  submitPublicActivityRegistrationByLudoSlug,
} from '$lib/server/services/public-activity-registrations.js'

const MAX_BODY_BYTES = 16_384

function responseHeaders(request: Request) {
  const headers = publicCorsHeaders(request)
  if (!headers) return null
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')
  headers.set('Cache-Control', 'no-store')
  return headers
}

function sourceKey(request: Request) {
  const source = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  return createHash('sha256').update(source).digest('hex')
}

async function readUtf8BodyWithinLimit(request: Request) {
  if (!request.body) return { ok: true as const, text: '' }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    byteLength += value.byteLength
    if (byteLength > MAX_BODY_BYTES) {
      try {
        await reader.cancel('Payload too large')
      } catch {
        // Annulation best-effort : le dépassement reste toujours une réponse 413.
      }
      return { ok: false as const }
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true as const, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
}

export const POST: RequestHandler = async ({ params, request }) => {
  const headers = responseHeaders(request)
  if (!headers) return json({ error: 'Origin not allowed' }, { status: 403 })
  const size = Number(request.headers.get('content-length') ?? 0)
  if (size > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, { status: 413, headers })

  // La clé ne contient ni tenant ni activité : changer de slug ne contourne pas la limite.
  const rate = checkRateLimit(
    `public-activity-registration:${sourceKey(request)}`,
    5,
    10 * 60 * 1000,
  )
  if (!rate.ok) {
    headers.set('Retry-After', String(rate.retryAfter))
    return json({ error: 'Too many requests' }, { status: 429, headers })
  }

  let body: Record<string, unknown>
  try {
    const raw = await readUtf8BodyWithinLimit(request)
    if (!raw.ok) return json({ error: 'Payload too large' }, { status: 413, headers })
    body = JSON.parse(raw.text)
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400, headers })
  }
  if (typeof body.website === 'string' && body.website.trim())
    return json({ accepted: true }, { status: 202, headers })

  try {
    const result = await submitPublicActivityRegistrationByLudoSlug(
      params.ludo,
      params.slug,
      request.headers.get('idempotency-key') ?? '',
      {
        contactName: body.contactName as string,
        email: body.email as string,
        phone: body.phone as string | null,
        participantCount: body.participantCount as number,
        message: body.message as string | null,
      },
    )
    return json(
      {
        accepted: true,
        receiptId: result.receiptId,
        status: result.status,
        message: result.message,
      },
      { status: result.created ? 201 : 200, headers },
    )
  } catch (error) {
    if (error instanceof PublicActivityRegistrationServiceError)
      return json(
        { error: error.code === 'not_found' ? 'Not found' : 'Invalid request' },
        {
          status: error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400,
          headers,
        },
      )
    throw error
  }
}

export const OPTIONS: RequestHandler = async ({ request }) => {
  const headers = responseHeaders(request)
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 })
}
