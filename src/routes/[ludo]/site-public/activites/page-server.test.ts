import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/db/sites.js', () => ({ listSiteRowsWithOpeningHours: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => ({ isPublicSiteEnabled: vi.fn(), PublicSiteServiceError: class extends Error {} }))
vi.mock('$lib/server/services/public-editorial-assets.js', () => ({ addPublicActivitySupportImage: vi.fn(), addPublicPdfAttachment: vi.fn(), deletePublicEditorialAsset: vi.fn(), PublicEditorialAssetServiceError: class extends Error {} }))
vi.mock('$lib/server/services/public-activities.js', () => ({
  PublicActivityServiceError: class extends Error {}, createPublicActivity: vi.fn(), updatePublicActivity: vi.fn(), listPublicActivitiesForManagement: vi.fn(),
  publishPublicActivity: vi.fn(), hidePublicActivity: vi.fn(), archivePublicActivity: vi.fn(), trashPublicActivity: vi.fn(), restorePublicActivity: vi.fn(), permanentlyDeletePublicActivity: vi.fn(), getPublicActivity: vi.fn(), authorizePublicActivityMediaScope: vi.fn(), clearPublicActivityImage: vi.fn(), setPublicActivityFeaturedRank: vi.fn(), setPublicActivityImage: vi.fn(),
}))
vi.mock('$lib/server/media/blob-storage.js', () => ({ deletePublicSiteMedia: vi.fn(), uploadPublicSiteMedia: vi.fn(), MediaStorageError: class extends Error {} }))
vi.mock('$lib/server/media/media-service.js', () => ({ uploadAndRegisterMedia: vi.fn(), MediaCompensationError: class extends Error {} }))
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import { createPublicActivity, listPublicActivitiesForManagement } from '$lib/server/services/public-activities.js'
import { actions, load } from './+page.server.js'

const L = '11111111-1111-4111-8111-111111111111', M = '22222222-2222-4222-8222-222222222222'
const activity = { id: 'activity', revision: 1, status: 'draft', title: 'Atelier', assets: [], imageUrl: null }
function event(fields: Array<[string, string]> = []) { const data = new FormData(); fields.forEach(([key, value]) => data.append(key, value)); return { params: { ludo: 'demo' }, request: new Request('http://x', { method: 'POST', body: data }) } }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L }, member: { id: M } } as never); vi.mocked(isPublicSiteEnabled).mockResolvedValue(true); vi.mocked(listPublicActivitiesForManagement).mockResolvedValue([activity] as never); vi.mocked(createPublicActivity).mockResolvedValue(activity as never) })

describe('route activités simplifiée', () => {
  it('charge les activités du tenant', async () => { await expect(load(event() as never)).resolves.toMatchObject({ activities: [activity] }) })
  it('transmet seulement le rythme et la description libre', async () => {
    vi.mocked(createPublicActivity).mockResolvedValue({ ...activity, status: 'hidden' } as never)
    await actions.create!(event([['title', 'Atelier'], ['slug', 'atelier'], ['summary', 'Pour toutes et tous'], ['body', 'Les mercredis à 15h, sauf vacances.'], ['location', 'Salle jeux'], ['type', 'recurring'], ['targetMode', 'all']]) as never)
    expect(createPublicActivity).toHaveBeenCalledWith(L, M, { title: 'Atelier', slug: 'atelier', summary: 'Pour toutes et tous', body: 'Les mercredis à 15h, sauf vacances.', location: 'Salle jeux', type: 'recurring', targetMode: 'all', siteIds: [] })
  })
  it('refuse un rythme inconnu', async () => {
    const result = await actions.create!(event([['title', 'Atelier'], ['type', 'weekly'], ['targetMode', 'all']]) as never)
    expect(result).toMatchObject({ status: 400 })
    expect(createPublicActivity).not.toHaveBeenCalled()
  })
})
