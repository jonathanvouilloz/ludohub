import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getFaqs, publicCorsHeaders } = vi.hoisted(() => ({
  getFaqs: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({ getPublicFaqsByLudoSlug: getFaqs }))
vi.mock('$lib/server/public-http.js', () => ({
  PUBLIC_CACHE_CONTROL: 'public, max-age=30, s-maxage=60, must-revalidate',
  publicCorsHeaders,
}))
import { GET } from './+server.js'

beforeEach(() => {
  vi.clearAllMocks()
  publicCorsHeaders.mockReturnValue(new Headers())
})

describe('GET /api/public/v1/[ludo]/faqs', () => {
  it('valide la limite et transmet le filtre de lieu', async () => {
    getFaqs.mockResolvedValueOnce({ faqs: [] })
    const request = new Request('https://api.test/api/public/v1/demo/faqs?site=paquis&limit=25')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(200)
    expect(getFaqs).toHaveBeenCalledWith('demo', 'paquis', 25)
  })
})
