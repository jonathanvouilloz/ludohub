import { describe, expect, it, vi } from 'vitest'

vi.mock('$env/dynamic/private', () => ({
  env: { EXTENSION_API_ALLOWED_ORIGINS: 'chrome-extension://allowed,https://orphee.test' },
}))
vi.mock('./services/extension-auth.js', () => ({
  ExtensionAuthError: class ExtensionAuthError extends Error {
    constructor(public code: string) {
      super(code)
    }
  },
  authenticateAccessToken: vi.fn(),
}))

import { bearer, extensionHeaders, readExtensionJson } from './extension-http.js'

describe('frontière HTTP extension', () => {
  it('autorise seulement une origine configurée et impose no-store', () => {
    const allowed = extensionHeaders(
      new Request('https://api.test/x', { headers: { origin: 'chrome-extension://allowed' } }),
      'GET',
    )
    expect(allowed?.get('access-control-allow-origin')).toBe('chrome-extension://allowed')
    expect(allowed?.get('cache-control')).toContain('no-store')
    expect(
      extensionHeaders(
        new Request('https://api.test/x', { headers: { origin: 'chrome-extension://evil' } }),
        'GET',
      ),
    ).toBeNull()
  })

  it('tolère le client natif sans Origin mais ne produit aucun wildcard', () => {
    const headers = extensionHeaders(new Request('https://api.test/x'), 'POST')
    expect(headers?.has('access-control-allow-origin')).toBe(false)
  })

  it('lit un JSON borné et rejette content-length au-delà de 8 Kio', async () => {
    await expect(
      readExtensionJson(new Request('https://api.test/x', { method: 'POST', body: '{"ok":true}' })),
    ).resolves.toEqual({ ok: true })
    await expect(
      readExtensionJson(
        new Request('https://api.test/x', {
          method: 'POST',
          body: '{}',
          headers: { 'content-length': '8193' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_request' })
  })

  it('accepte uniquement un Bearer opaque sans espaces parasites', () => {
    expect(
      bearer(
        new Request('https://api.test/x', {
          headers: { authorization: `Bearer lda_${'a'.repeat(32)}` },
        }),
      ),
    ).toMatch(/^lda_/)
    expect(
      bearer(
        new Request('https://api.test/x', {
          headers: { authorization: `bearer lda_${'a'.repeat(32)}` },
        }),
      ),
    ).toBeNull()
  })
})
