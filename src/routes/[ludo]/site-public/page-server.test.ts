import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireResponsableContext: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return {
    PublicSiteServiceError,
    getPublicSiteState: vi.fn(),
    setPublicSiteEnabled: vi.fn(),
  }
})
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))

import { requireResponsableContext } from '$lib/server/ludo-context.js'
import { getPublicSiteState, setPublicSiteEnabled } from '$lib/server/services/public-site.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { actions } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const SETTINGS_ID = '33333333-3333-4333-8333-333333333333'

function event(enabled: boolean) {
  const formData = new FormData()
  formData.set('enabled', String(enabled))
  return { request: new Request('http://local.test', { method: 'POST', body: formData }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireResponsableContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID },
  } as never)
})

describe('action Site public', () => {
  it('active le tenant et audite la transition réelle avec la ligne de réglage', async () => {
    vi.mocked(getPublicSiteState).mockResolvedValue({ enabled: false } as never)
    vi.mocked(setPublicSiteEnabled).mockResolvedValue({ id: SETTINGS_ID, enabled: true } as never)

    await actions.toggle!(event(true) as never)

    expect(setPublicSiteEnabled).toHaveBeenCalledWith(LUDO_ID, true)
    expect(emitAuditEvent).toHaveBeenCalledWith({
      action: 'public_site.enabled',
      actorLudoId: LUDO_ID,
      actorMemberId: MEMBER_ID,
      entityType: 'public_site_settings',
      entityId: SETTINGS_ID,
      metadata: { fromEnabled: false, toEnabled: true },
    })
  })

  it("n'audite pas un double submit sans changement d'état", async () => {
    vi.mocked(getPublicSiteState).mockResolvedValue({ enabled: true } as never)
    vi.mocked(setPublicSiteEnabled).mockResolvedValue({ id: SETTINGS_ID, enabled: true } as never)

    await actions.toggle!(event(true) as never)

    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('vérifie le rôle responsable avant toute mutation', async () => {
    vi.mocked(requireResponsableContext).mockRejectedValue(new Error('403'))

    await expect(actions.toggle!(event(true) as never)).rejects.toThrow('403')
    expect(setPublicSiteEnabled).not.toHaveBeenCalled()
  })
})
