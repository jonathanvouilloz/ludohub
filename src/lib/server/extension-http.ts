import { env } from '$env/dynamic/private'
import { json } from '@sveltejs/kit'
import type { ExtensionPrincipal } from './services/extension-auth.js'
import { authenticateAccessToken, ExtensionAuthError } from './services/extension-auth.js'

export const EXTENSION_NO_STORE = 'no-store, max-age=0'
const MAX_BODY_BYTES = 8 * 1024

function allowedOrigins() {
  return new Set(
    (env.EXTENSION_API_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

export function extensionHeaders(request: Request, methods: string) {
  const headers = new Headers({ 'Cache-Control': EXTENSION_NO_STORE, Vary: 'Origin' })
  const origin = request.headers.get('origin')
  if (!origin) return headers
  if (!allowedOrigins().has(origin)) return null
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', `${methods}, OPTIONS`)
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  return headers
}

export async function readExtensionJson(request: Request): Promise<Record<string, unknown>> {
  const announced = Number(request.headers.get('content-length') ?? 0)
  if (announced > MAX_BODY_BYTES) throw new ExtensionAuthError('invalid_request')
  if (!request.body) throw new ExtensionAuthError('invalid_request')
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new ExtensionAuthError('invalid_request')
    }
    raw += decoder.decode(value, { stream: true })
  }
  raw += decoder.decode()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ExtensionAuthError('invalid_request')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new ExtensionAuthError('invalid_request')
  return parsed as Record<string, unknown>
}

export function bearer(request: Request) {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]{20,200})$/)
  return match?.[1] ?? null
}

export function extensionError(error: unknown, headers: Headers) {
  if (!(error instanceof ExtensionAuthError)) throw error
  const status =
    error.code === 'invalid_token'
      ? 401
      : error.code === 'authorization_pending' || error.code === 'slow_down'
        ? 400
        : error.code === 'conflict'
          ? 409
          : 400
  if (error.code === 'invalid_token')
    headers.set('WWW-Authenticate', 'Bearer realm="ludohub-extension"')
  return json({ error: error.code }, { status, headers })
}

export async function requireExtensionPrincipal(request: Request): Promise<ExtensionPrincipal> {
  return authenticateAccessToken(bearer(request))
}
