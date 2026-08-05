import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDirectory, publicCorsHeaders } = vi.hoisted(() => ({
  getDirectory: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({
  getPublicDirectoryByLudoSlug: getDirectory,
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

describe('GET /api/public/v1/[ludo]/directory', () => {
  it('retourne la projection publique du service', async () => {
    getDirectory.mockResolvedValueOnce({ ludo: { slug: 'demo' }, entries: [] })
    const request = new Request('https://api.test/api/public/v1/demo/directory?limit=25')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(200)
    expect(getDirectory).toHaveBeenCalledWith('demo', 25)
    expect(await response.json()).toEqual({
      version: 1,
      data: { ludo: { slug: 'demo' }, entries: [] },
    })
  })

  it('borne strictement la limite', async () => {
    const request = new Request('https://api.test/api/public/v1/demo/directory?limit=201')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(400)
    expect(getDirectory).not.toHaveBeenCalled()
  })
})
