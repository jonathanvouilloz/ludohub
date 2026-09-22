import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), insert: vi.fn(), update: vi.fn(), pub: vi.fn(), photo: vi.fn(), remove: vi.fn(), list: vi.fn(), visible: vi.fn(), sites: vi.fn(), enabled: vi.fn() }))
vi.mock('../db/public-profiles.js', () => ({
  getPublicProfileRowForLudo: m.get, insertPublicProfileAtomic: m.insert, updatePublicProfileAtomic: m.update,
  updatePublicProfilePublicationRow: m.pub, updatePublicProfilePhotoRow: m.photo, deleteDraftPublicProfileRow: m.remove,
  deletePublicProfileRow: m.remove, listPublicProfileRows: m.list, listVisiblePublicProfileRows: m.visible,
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: m.sites }))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled: m.enabled }))
vi.mock('./public-faqs.js', () => ({ validatePublicEditorialText: (value: string, label: string, max: number) => {
  const normalized = value.trim(); if (!normalized || normalized.length > max) throw new Error(`${label} invalide`); return normalized
} }))
import { createPublicProfile, listVisiblePublicProfiles, publishPublicProfile, updatePublicProfile } from './public-profiles.js'

const L = '00000000-0000-4000-8000-000000000001', P = '00000000-0000-4000-8000-000000000002', M = '00000000-0000-4000-8000-000000000003'
const row = (changes: Record<string, unknown> = {}) => ({ id: P, ludoId: L, section: 'team', displayName: 'Ada', roleTitle: null, bioText: null, photoUrl: null, photoStorageKey: null, photoAlt: null, status: 'draft', revision: 1, publishedAt: null, publishedByMemberId: null, ...changes })
beforeEach(() => { vi.clearAllMocks(); m.get.mockResolvedValue(row()); m.insert.mockResolvedValue(row()); m.update.mockResolvedValue(row({ revision: 2 })); m.pub.mockResolvedValue(row({ revision: 2 })); m.enabled.mockResolvedValue(true); m.sites.mockResolvedValue([{ id: 'site', ludoId: L }]); m.visible.mockResolvedValue([]) })

describe('profils simplifiés', () => {
  it('crée un profil autonome avec une bio texte', async () => {
    await createPublicProfile(L, M, { section: 'team', displayName: ' Ada ', bioText: ' Présentation ' })
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Ada', bioText: 'Présentation', photoAlt: null }))
    expect(m.insert.mock.calls[0][0]).not.toHaveProperty('memberId')
  })
  it('limite la bio à 255 caractères', async () => {
    await expect(createPublicProfile(L, M, { section: 'team', displayName: 'Ada', bioText: 'x'.repeat(256) })).rejects.toThrow(/biographie/i)
  })
  it('publie seulement lorsque le module et un lieu actif existent', async () => {
    m.enabled.mockResolvedValue(false)
    await expect(publishPublicProfile(P, L, M, 1)).rejects.toThrow(/publication exige/i)
  })
  it('met à jour et borne une projection sans lien interne', async () => {
    await updatePublicProfile(P, L, { bioText: 'Bio' }, M, 1)
    expect(m.update).toHaveBeenCalledWith(P, L, 1, expect.objectContaining({ bioText: 'Bio' }))
    await listVisiblePublicProfiles(L, 'team', undefined, 999)
    expect(m.visible).toHaveBeenCalledWith(L, 'team', undefined, 200)
  })
})
