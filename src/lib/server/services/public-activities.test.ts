import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/public-activities.js', () => ({
  getPublicActivityRowForLudo: vi.fn(), getVisiblePublicActivityRowBySlug: vi.fn(),
  insertPublicActivityAtomic: vi.fn(), listPublicActivityRows: vi.fn(), listVisiblePublicActivitySummaryRows: vi.fn(),
  permanentlyDeletePublicActivityRow: vi.fn(), updatePublicActivityAtomic: vi.fn(), updatePublicActivityFeaturedRow: vi.fn(), updatePublicActivityImageRow: vi.fn(), updatePublicActivityLifecycleRow: vi.fn(), updatePublicActivityPublicationRow: vi.fn(),
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: vi.fn() }))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled: vi.fn(), validatePublicSiteTargets: vi.fn() }))
vi.mock('./public-news.js', () => ({ normalizePublicNewsSlug: vi.fn((x: string) => x.toLowerCase().replace(/\s+/g, '-')), validatePublicNewsMarkdown: vi.fn((x: string) => x.trim()) }))

import { getPublicActivityRowForLudo, insertPublicActivityAtomic, listVisiblePublicActivitySummaryRows, updatePublicActivityPublicationRow } from '../db/public-activities.js'
import { listActiveSiteRows } from '../db/sites.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'
import { createPublicActivity, listVisiblePublicActivitySummaries, publishPublicActivity, PublicActivityServiceError } from './public-activities.js'

const ludo = 'ludo', member = 'member', now = new Date('2026-09-23T12:00:00Z')
const row = (overrides: Record<string, unknown> = {}) => ({ id: 'activity', ludoId: ludo, slug: 'atelier', title: 'Atelier', summary: 'Résumé', body: 'Texte', location: null, type: 'one_off', imageUrl: null, imageStorageKey: null, imageAlt: null, status: 'draft', lifecycle: 'active', featuredRank: null, registrationEnabled: false, registrationCapacity: null, revision: 1, authorMemberId: member, updatedByMemberId: member, publishedByMemberId: null, publishedAt: null, archivedAt: null, trashedAt: null, createdAt: now, updatedAt: now, targets: [], assets: [], ...overrides })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(insertPublicActivityAtomic).mockResolvedValue(row() as never)
  vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(row() as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listActiveSiteRows).mockResolvedValue([{ id: 'site', ludoId: ludo, isActive: true }] as never)
  vi.mocked(validatePublicSiteTargets).mockResolvedValue([])
  vi.mocked(listVisiblePublicActivitySummaryRows).mockResolvedValue([])
  vi.mocked(updatePublicActivityPublicationRow).mockResolvedValue(row({ revision: 2 }) as never)
})

describe('activité simplifiée', () => {
  it('crée un rythme sans calendrier structuré', async () => {
    await createPublicActivity(ludo, member, { slug: 'Atelier du mercredi', title: 'Atelier', summary: 'Résumé', body: 'Chaque mercredi à 15h.', type: 'recurring', targetMode: 'all', siteIds: [] }, now)
    expect(insertPublicActivityAtomic).toHaveBeenCalledWith(expect.objectContaining({ type: 'recurring', slug: 'atelier-du-mercredi' }), [])
  })
  it('garde un ciblage explicite strict', async () => {
    await expect(createPublicActivity(ludo, member, { slug: 'x', title: 'x', summary: 'x', body: 'x', type: 'one_off', targetMode: 'explicit', siteIds: [] })).rejects.toBeInstanceOf(PublicActivityServiceError)
  })
  it('publie seulement avec site public activé et lieu actif', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(publishPublicActivity('activity', ludo, member, 1)).rejects.toThrow(/module/i)
  })
  it('borne les listes publiques à 50', async () => {
    await listVisiblePublicActivitySummaries(ludo, undefined, 500)
    expect(listVisiblePublicActivitySummaryRows).toHaveBeenCalledWith(ludo, undefined, 'active', 50)
  })
})
