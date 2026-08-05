import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDocuments, publicCorsHeaders } = vi.hoisted(() => ({
  getDocuments: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({
  getPublicDocumentsByLudoSlug: getDocuments,
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

describe('GET /api/public/v1/[ludo]/documents', () => {
  it('refuse une limite hors contrat avant le service', async () => {
    const request = new Request('https://api.test/api/public/v1/demo/documents?limit=51')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(400)
    expect(getDocuments).not.toHaveBeenCalled()
  })
})
