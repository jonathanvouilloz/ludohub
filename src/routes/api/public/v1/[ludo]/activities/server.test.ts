import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getActivities, publicCorsHeaders } = vi.hoisted(() => ({
  getActivities: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({
  getPublicActivitiesByLudoSlug: getActivities,
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

describe('GET /api/public/v1/[ludo]/activities', () => {
  it('borne la limite avant tout accès au tenant', async () => {
    const request = new Request('https://api.test/api/public/v1/demo/activities?limit=51')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(400)
    expect(getActivities).not.toHaveBeenCalled()
  })

  it('transmet site et limite avec un cache public court', async () => {
    getActivities.mockResolvedValueOnce({ activities: [] })
    const request = new Request(
      'https://api.test/api/public/v1/demo/activities?site=paquis&limit=3',
    )
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(getActivities).toHaveBeenCalledWith('demo', 'paquis', 3)
    expect(response.headers.get('cache-control')).toContain('s-maxage=60')
  })
})
