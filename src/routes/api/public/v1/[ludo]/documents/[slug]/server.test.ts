import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDetail, publicCorsHeaders } = vi.hoisted(() => ({
  getDetail: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({
  getPublicDocumentDetailByLudoSlug: getDetail,
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

describe('GET /api/public/v1/[ludo]/documents/[slug]', () => {
  it('répond 404/no-store quand le document ne doit pas être public', async () => {
    getDetail.mockResolvedValueOnce(null)
    const request = new Request('https://api.test/api/public/v1/demo/documents/inconnu')
    const response = await GET({
      params: { ludo: 'demo', slug: 'inconnu' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
