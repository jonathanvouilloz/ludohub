import { beforeEach, describe, expect, it, vi } from 'vitest'
const { getProfiles, publicCorsHeaders } = vi.hoisted(() => ({
  getProfiles: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({ getPublicProfilesByLudoSlug: getProfiles }))
vi.mock('$lib/server/public-http.js', () => ({
  PUBLIC_CACHE_CONTROL: 'public, max-age=30, s-maxage=60, must-revalidate',
  publicCorsHeaders,
}))
import { GET } from './+server.js'
beforeEach(() => {
  vi.clearAllMocks()
  publicCorsHeaders.mockReturnValue(new Headers())
})
describe('GET /api/public/v1/[ludo]/profiles', () => {
  it('refuse une section inconnue avant le service', async () => {
    const request = new Request('https://api.test/api/public/v1/demo/profiles?section=board')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(400)
    expect(getProfiles).not.toHaveBeenCalled()
  })
})
