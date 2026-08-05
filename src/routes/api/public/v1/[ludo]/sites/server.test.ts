import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPublicSitesByLudoSlug, publicCorsHeaders } = vi.hoisted(() => ({
  getPublicSitesByLudoSlug: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))

vi.mock('$lib/server/services/public-api.js', () => ({ getPublicSitesByLudoSlug }))
vi.mock('$lib/server/public-http.js', () => ({
  PUBLIC_CACHE_CONTROL: 'public, max-age=30, s-maxage=60, must-revalidate',
  publicCorsHeaders,
}))

import { GET, OPTIONS } from './+server.js'

const request = new Request('https://api.test/api/public/v1/demo/sites')

beforeEach(() => {
  vi.clearAllMocks()
  publicCorsHeaders.mockReturnValue(new Headers())
})

describe('GET /api/public/v1/[ludo]/sites', () => {
  it('répond 403 avant toute lecture pour une origine refusée', async () => {
    publicCorsHeaders.mockReturnValueOnce(null)
    const response = await GET({ params: { ludo: 'demo' }, request } as never)
    expect(response.status).toBe(403)
    expect(getPublicSitesByLudoSlug).not.toHaveBeenCalled()
  })

  it('ne distingue pas un tenant absent d’un module désactivé', async () => {
    getPublicSitesByLudoSlug.mockResolvedValueOnce(null)
    const response = await GET({ params: { ludo: 'demo' }, request } as never)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('retourne un contrat versionné et mis en cache', async () => {
    getPublicSitesByLudoSlug.mockResolvedValueOnce({
      ludo: { slug: 'demo', name: 'Démo' },
      sites: [],
    })
    const response = await GET({ params: { ludo: 'demo' }, request } as never)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=30, s-maxage=60, must-revalidate',
    )
    await expect(response.json()).resolves.toEqual({
      version: 1,
      data: { ludo: { slug: 'demo', name: 'Démo' }, sites: [] },
    })
  })
})

describe('OPTIONS /api/public/v1/[ludo]/sites', () => {
  it('répond sans corps avec les en-têtes CORS autorisés', async () => {
    const response = await OPTIONS({ request } as never)
    expect(response.status).toBe(204)
  })
})
