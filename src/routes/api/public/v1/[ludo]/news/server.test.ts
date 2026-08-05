import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPublicNewsByLudoSlug, publicCorsHeaders } = vi.hoisted(() => ({
  getPublicNewsByLudoSlug: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({ getPublicNewsByLudoSlug }))
vi.mock('$lib/server/public-http.js', () => ({
  PUBLIC_CACHE_CONTROL: 'public, max-age=30, s-maxage=60, must-revalidate',
  publicCorsHeaders,
}))

import { GET } from './+server.js'

beforeEach(() => {
  vi.clearAllMocks()
  publicCorsHeaders.mockReturnValue(new Headers())
})

describe('GET /api/public/v1/[ludo]/news', () => {
  it('valide la limite avant de lire le tenant', async () => {
    const request = new Request('https://api.test/api/public/v1/demo/news?limit=0')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(400)
    expect(getPublicNewsByLudoSlug).not.toHaveBeenCalled()
  })

  it('transmet site et limite puis applique le cache court', async () => {
    getPublicNewsByLudoSlug.mockResolvedValueOnce({
      ludo: { slug: 'demo', name: 'Démo' },
      site: 'paquis',
      news: [],
    })
    const request = new Request('https://api.test/api/public/v1/demo/news?site=paquis&limit=3')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(getPublicNewsByLudoSlug).toHaveBeenCalledWith('demo', 'paquis', 3)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=30, s-maxage=60, must-revalidate',
    )
  })
})
