import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPublicAnnouncementsByLudoSlug, publicCorsHeaders } = vi.hoisted(() => ({
  getPublicAnnouncementsByLudoSlug: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))

vi.mock('$lib/server/services/public-api.js', () => ({ getPublicAnnouncementsByLudoSlug }))
vi.mock('$lib/server/public-http.js', () => ({
  PUBLIC_CACHE_CONTROL: 'public, max-age=30, s-maxage=60, must-revalidate',
  publicCorsHeaders,
}))

import { GET } from './+server.js'

beforeEach(() => {
  vi.clearAllMocks()
  publicCorsHeaders.mockReturnValue(new Headers())
})

describe('GET /api/public/v1/[ludo]/announcements', () => {
  it('transmet le filtre de lieu public et retourne le contrat versionné', async () => {
    getPublicAnnouncementsByLudoSlug.mockResolvedValueOnce({
      ludo: { slug: 'demo', name: 'Démo' },
      site: 'paquis',
      announcements: [],
    })
    const request = new Request('https://api.test/api/public/v1/demo/announcements?site=paquis')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)

    expect(getPublicAnnouncementsByLudoSlug).toHaveBeenCalledWith('demo', 'paquis')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=30, s-maxage=60, must-revalidate',
    )
    await expect(response.json()).resolves.toEqual({
      version: 1,
      data: {
        ludo: { slug: 'demo', name: 'Démo' },
        site: 'paquis',
        announcements: [],
      },
    })
  })

  it('répond 404/no-store pour un tenant privé ou un lieu inconnu', async () => {
    getPublicAnnouncementsByLudoSlug.mockResolvedValueOnce(null)
    const request = new Request('https://api.test/api/public/v1/demo/announcements')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
