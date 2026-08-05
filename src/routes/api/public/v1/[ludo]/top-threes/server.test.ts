import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getTopThrees, publicCorsHeaders } = vi.hoisted(() => ({
  getTopThrees: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({
  getPublicTopThreesByLudoSlug: getTopThrees,
}))
vi.mock('$lib/server/public-http.js', () => ({
  PUBLIC_CACHE_CONTROL: 'public, max-age=30, s-maxage=60, must-revalidate',
  publicCorsHeaders,
}))

import { GET } from './+server.js'

beforeEach(() => {
  vi.clearAllMocks()
  publicCorsHeaders.mockReturnValue(new Headers())
})

describe('GET /api/public/v1/[ludo]/top-threes', () => {
  it('borne la limite avant tout accès au tenant', async () => {
    const request = new Request('https://api.test/api/public/v1/demo/top-threes?limit=0')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(400)
    expect(getTopThrees).not.toHaveBeenCalled()
  })

  it('transmet le lieu et applique le cache court', async () => {
    getTopThrees.mockResolvedValueOnce({ topThrees: [] })
    const request = new Request(
      'https://api.test/api/public/v1/demo/top-threes?site=paquis&limit=3',
    )
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(getTopThrees).toHaveBeenCalledWith('demo', 'paquis', 3)
    expect(response.headers.get('cache-control')).toContain('s-maxage=60')
  })
})
