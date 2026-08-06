import { createHash } from 'node:crypto'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { publicCorsHeaders } from '$lib/server/public-http.js'
import { checkRateLimit } from '$lib/server/services/rate-limit.js'
import { FamilyRegistrationServiceError, submitPublicFamilyMembership } from '$lib/server/services/family-registrations.js'

const MAX_BODY_BYTES = 32_768
function headers(request: Request) {
  const value = publicCorsHeaders(request)
  if (!value) return null
  value.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  value.set('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')
  value.set('Cache-Control', 'no-store')
  return value
}
async function readBody(request: Request) {
  if (!request.body) return ''
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BODY_BYTES) { await reader.cancel().catch(() => undefined); return null }; chunks.push(value) }
  const all = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length }
  return new TextDecoder('utf-8', { fatal: true }).decode(all)
}

export const POST: RequestHandler = async ({ params, request }) => {
  const responseHeaders = headers(request)
  if (!responseHeaders) return json({ error: 'Origin not allowed' }, { status: 403 })
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, { status: 413, headers: responseHeaders })
  const source = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rate = checkRateLimit(`family-membership:${createHash('sha256').update(source).digest('hex')}`, 5, 10 * 60 * 1000)
  if (!rate.ok) { responseHeaders.set('Retry-After', String(rate.retryAfter)); return json({ error: 'Too many requests' }, { status: 429, headers: responseHeaders }) }
  let body: Record<string, unknown>
  try { const raw = await readBody(request); if (raw === null) return json({ error: 'Payload too large' }, { status: 413, headers: responseHeaders }); body = JSON.parse(raw); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error() }
  catch { return json({ error: 'Invalid JSON' }, { status: 400, headers: responseHeaders }) }
  if (typeof body.website === 'string' && body.website.trim()) return json({ accepted: true }, { status: 202, headers: responseHeaders })
  try {
    const result = await submitPublicFamilyMembership(params.ludo, request.headers.get('idempotency-key') ?? '', body)
    return json({ accepted: true, receiptId: result.receiptId, submittedAt: result.submittedAt }, { status: result.created ? 201 : 200, headers: responseHeaders })
  } catch (error) {
    if (error instanceof FamilyRegistrationServiceError) return json({ error: error.code === 'not_found' ? 'Not found' : 'Invalid request' }, { status: error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400, headers: responseHeaders })
    throw error
  }
}
export const OPTIONS: RequestHandler = async ({ request }) => { const responseHeaders = headers(request); return responseHeaders ? new Response(null, { status: 204, headers: responseHeaders }) : new Response(null, { status: 403 }) }
