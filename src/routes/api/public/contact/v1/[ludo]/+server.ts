import { createHash } from 'node:crypto'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { publicCorsHeaders } from '$lib/server/public-http.js'
import { checkRateLimit } from '$lib/server/services/rate-limit.js'
import {
  PublicContactServiceError,
  submitPublicContactByLudoSlug,
} from '$lib/server/services/public-contacts.js'
function headers(request: Request) {
  const h = publicCorsHeaders(request)
  if (!h) return null
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  h.set('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')
  h.set('Cache-Control', 'no-store')
  return h
}
function sourceKey(request: Request) {
  const raw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  return createHash('sha256').update(raw).digest('hex')
}
const MAX_BODY_BYTES = 16_384
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
        // L'annulation est best-effort ; le dépassement reste toujours une réponse 413.
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
  const h = headers(request)
  if (!h) return json({ error: 'Origin not allowed' }, { status: 403 })
  const size = Number(request.headers.get('content-length') ?? 0)
  if (size > MAX_BODY_BYTES)
    return json({ error: 'Payload too large' }, { status: 413, headers: h })
  const rate = checkRateLimit(`public-contact:${sourceKey(request)}`, 5, 10 * 60 * 1000)
  if (!rate.ok) {
    h.set('Retry-After', String(rate.retryAfter))
    return json({ error: 'Too many requests' }, { status: 429, headers: h })
  }
  let body: Record<string, unknown>
  try {
    const raw = await readUtf8BodyWithinLimit(request)
    if (!raw.ok) return json({ error: 'Payload too large' }, { status: 413, headers: h })
    body = JSON.parse(raw.text)
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400, headers: h })
  }
  if (typeof body.website === 'string' && body.website.trim())
    return json({ accepted: true }, { status: 202, headers: h })
  const key = request.headers.get('idempotency-key') ?? ''
  try {
    const result = await submitPublicContactByLudoSlug(params.ludo, key, {
      recipient: body.recipient as 'paquis' | 'secheron' | 'general',
      name: body.name as string,
      email: body.email as string,
      phone: body.phone as string | null,
      subject: body.subject as string,
      message: body.message as string,
    })
    return json(
      { accepted: true, receiptId: result.receiptId },
      { status: result.created ? 201 : 200, headers: h },
    )
  } catch (e) {
    if (e instanceof PublicContactServiceError)
      return json(
        { error: e.code === 'not_found' ? 'Not found' : 'Invalid request' },
        { status: e.code === 'not_found' ? 404 : 400, headers: h },
      )
    throw e
  }
}
export const OPTIONS: RequestHandler = async ({ request }) => {
  const h = headers(request)
  return h ? new Response(null, { status: 204, headers: h }) : new Response(null, { status: 403 })
}
