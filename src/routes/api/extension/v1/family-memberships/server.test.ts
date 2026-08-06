import { expect, it, vi } from 'vitest'

const list = vi.hoisted(() => vi.fn())
vi.mock('$lib/server/extension-http.js', () => ({
  extensionHeaders: () => new Headers({ 'Cache-Control': 'no-store' }),
  requireExtensionPrincipal: vi.fn().mockResolvedValue({ ludoId: 'tenant-from-token' }),
  extensionError: (error: unknown) => {
    throw error
  },
}))
vi.mock('$lib/server/services/family-registrations.js', () => ({ listFamilySubmissions: list }))

import { GET } from './+server.js'

it('résume la liste sans UUID de tenant, site ou membre', async () => {
  list.mockResolvedValue([
    {
      id: 'submission',
      siteId: 'hidden-site-id',
      siteSlug: 'centre',
      siteName: 'Centre',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
      status: 'new',
      paymentMethod: null,
      paymentRecordedAt: null,
      revision: 1,
      processedAt: null,
      createdAt: new Date('2026-08-06T10:00:00Z'),
    },
  ])
  const response = await GET({
    request: new Request('https://api.test/api/extension/v1/family-memberships'),
    url: new URL('https://api.test/api/extension/v1/family-memberships'),
  } as never)
  expect(list).toHaveBeenCalledWith('tenant-from-token', undefined, 100)
  expect(await response.json()).toEqual({
    submissions: [
      {
        id: 'submission',
        site: { slug: 'centre', name: 'Centre' },
        submittedAt: '2026-08-06T10:00:00.000Z',
        responsible: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' },
        status: 'new',
        payment: { method: null, recordedAt: null },
        revision: 1,
        processedAt: null,
      },
    ],
  })
})
