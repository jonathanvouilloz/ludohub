import { beforeEach, describe, expect, it, vi } from 'vitest'
const { getGallery, publicCorsHeaders } = vi.hoisted(() => ({
  getGallery: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({ getPublicGalleryByLudoSlug: getGallery }))
vi.mock('$lib/server/public-http.js', () => ({
  PUBLIC_CACHE_CONTROL: 'public, max-age=30, s-maxage=60, must-revalidate',
  publicCorsHeaders,
}))
import { GET } from './+server.js'
beforeEach(() => {
  vi.clearAllMocks()
  publicCorsHeaders.mockReturnValue(new Headers())
})
describe('GET /api/public/v1/[ludo]/gallery', () => {
  it('borne la liste publique', async () => {
    const request = new Request('https://api.test/api/public/v1/demo/gallery?limit=101')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(400)
    expect(getGallery).not.toHaveBeenCalled()
  })
})
