import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => ({ isPublicSiteEnabled: vi.fn(), PublicSiteServiceError: class extends Error {} }))
vi.mock('$lib/server/services/public-profiles.js', () => ({
  PublicProfileServiceError: class extends Error {}, listPublicProfilesForManagement: vi.fn(), createPublicProfile: vi.fn(),
  updatePublicProfile: vi.fn(), publishPublicProfile: vi.fn(), hidePublicProfile: vi.fn(), permanentlyDeletePublicProfile: vi.fn(),
  authorizePublicProfileMediaScope: vi.fn(), setPublicProfilePhoto: vi.fn(), clearPublicProfilePhoto: vi.fn(),
}))
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import { createPublicProfile, listPublicProfilesForManagement } from '$lib/server/services/public-profiles.js'
import { actions, load } from './+page.server.js'

const L = '11111111-1111-4111-8111-111111111111', M = '22222222-2222-4222-8222-222222222222'
const profile = { id: 'profile', revision: 1, section: 'team', displayName: 'Alice', roleTitle: 'Présidente', bioText: 'Bio', photoUrl: null }
function event(fields: Array<[string, FormDataEntryValue]> = []) { const data = new FormData(); fields.forEach(([key, value]) => data.append(key, value)); return { params: { ludo: 'demo' }, request: new Request('http://x', { method: 'POST', body: data }) } }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L }, member: { id: M } } as never); vi.mocked(isPublicSiteEnabled).mockResolvedValue(true); vi.mocked(listPublicProfilesForManagement).mockResolvedValue([profile] as never); vi.mocked(createPublicProfile).mockResolvedValue(profile as never) })

describe('route profils simplifiée', () => {
  it('charge uniquement les profils de la ludothèque', async () => {
    await expect(load(event() as never)).resolves.toEqual({ profiles: [profile] })
  })
  it('crée un profil autonome avec une bio texte', async () => {
    await actions.create!(event([['section', 'team'], ['displayName', 'Alice'], ['roleTitle', 'Présidente'], ['bioText', 'Bio']]) as never)
    expect(createPublicProfile).toHaveBeenCalledWith(L, M, { section: 'team', displayName: 'Alice', roleTitle: 'Présidente', bioText: 'Bio' })
    expect(vi.mocked(createPublicProfile).mock.calls[0][2]).not.toHaveProperty('memberId')
  })
})
