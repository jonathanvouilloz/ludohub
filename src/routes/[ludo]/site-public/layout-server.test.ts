import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => ({ getPublicSiteState: vi.fn() }))
vi.mock('$lib/utils/permissions.js', () => ({ isResponsable: vi.fn() }))

import { requireLudoContext } from '$lib/server/ludo-context.js'
import { getPublicSiteState } from '$lib/server/services/public-site.js'
import { isResponsable } from '$lib/utils/permissions.js'
import { load } from './+layout.server.js'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({
    ludo: { id: '11111111-1111-4111-8111-111111111111' },
    member: { id: '22222222-2222-4222-8222-222222222222' },
  } as never)
})

describe('accès au module Site public', () => {
  it('masque un module désactivé à un membre simple', async () => {
    vi.mocked(getPublicSiteState).mockResolvedValue({ enabled: false } as never)
    vi.mocked(isResponsable).mockReturnValue(false)

    await expect(load({} as never)).rejects.toMatchObject({ status: 404 })
  })

  it("permet au responsable d'ouvrir un module désactivé pour l'activer", async () => {
    vi.mocked(getPublicSiteState).mockResolvedValue({ enabled: false } as never)
    vi.mocked(isResponsable).mockReturnValue(true)

    await expect(load({} as never)).resolves.toMatchObject({ canConfigure: true })
  })

  it('permet au membre actif de consulter un module activé', async () => {
    vi.mocked(getPublicSiteState).mockResolvedValue({ enabled: true } as never)
    vi.mocked(isResponsable).mockReturnValue(false)

    await expect(load({} as never)).resolves.toMatchObject({ canConfigure: false })
  })
})
