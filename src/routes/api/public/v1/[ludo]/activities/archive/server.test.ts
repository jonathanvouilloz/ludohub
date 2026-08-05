import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getArchived, publicCorsHeaders } = vi.hoisted(() => ({
  getArchived: vi.fn(),
  publicCorsHeaders: vi.fn(),
}))
vi.mock('$lib/server/services/public-api.js', () => ({
  getArchivedPublicActivitiesByLudoSlug: getArchived,
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

describe('GET /api/public/v1/[ludo]/activities/archive', () => {
  it('ne mélange pas la source archive avec la liste actuelle', async () => {
    getArchived.mockResolvedValueOnce({ activities: [] })
    const request = new Request('https://api.test/api/public/v1/demo/activities/archive')
    const response = await GET({
      params: { ludo: 'demo' },
      request,
      url: new URL(request.url),
    } as never)
    expect(response.status).toBe(200)
    expect(getArchived).toHaveBeenCalledWith('demo', undefined, 20)
  })
})
