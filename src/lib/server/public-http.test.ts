import { beforeEach, describe, expect, it, vi } from 'vitest'

const { privateEnv } = vi.hoisted(() => ({
  privateEnv: {} as Record<string, string | undefined>,
}))
vi.mock('$env/dynamic/private', () => ({ env: privateEnv }))

import { publicCorsHeaders } from './public-http.js'

beforeEach(() => {
  delete privateEnv.PUBLIC_API_ALLOWED_ORIGINS
})

describe('publicCorsHeaders', () => {
  it('autorise les appels serveur-à-serveur sans Origin', () => {
    const headers = publicCorsHeaders(new Request('https://api.test'))
    expect(headers).toBeInstanceOf(Headers)
    expect(headers?.get('vary')).toBe('Origin')
  })

  it('refuse une origine navigateur non configurée', () => {
    const request = new Request('https://api.test', { headers: { origin: 'https://evil.test' } })
    expect(publicCorsHeaders(request)).toBeNull()
  })

  it('retourne le CORS uniquement pour une origine explicitement autorisée', () => {
    privateEnv.PUBLIC_API_ALLOWED_ORIGINS = 'https://site.test, https://preview.test'
    const request = new Request('https://api.test', { headers: { origin: 'https://site.test' } })
    const headers = publicCorsHeaders(request)
    expect(headers?.get('access-control-allow-origin')).toBe('https://site.test')
    expect(headers?.get('vary')).toBe('Origin')
  })
})
