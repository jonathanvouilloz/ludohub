import { expect, it, vi } from 'vitest'

vi.mock('$lib/server/extension-http.js', () => ({
  extensionHeaders: () => new Headers({ 'Cache-Control': 'no-store' }),
  requireExtensionPrincipal: vi.fn().mockResolvedValue({
    sessionId: 'session',
    ludoId: 'hidden-tenant-id',
    memberId: 'hidden-member-id',
    label: 'Poste accueil',
    ludoName: 'Ludothèque des Pâquis',
    memberName: 'Ada',
  }),
  extensionError: (error: unknown) => {
    throw error
  },
}))

import { GET } from './+server.js'

it('expose uniquement l’identité autoritative nécessaire à l’extension', async () => {
  const response = await GET({
    request: new Request('https://api.test/api/extension/v1/session'),
  } as never)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({
    authenticated: true,
    session: {
      id: 'session',
      deviceName: 'Poste accueil',
      ludoName: 'Ludothèque des Pâquis',
      memberName: 'Ada',
      scopes: [
        'family-memberships:read',
        'family-memberships:process',
        'family-memberships:payment',
      ],
    },
  })
})
