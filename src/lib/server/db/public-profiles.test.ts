import { beforeEach, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  find: vi.fn(), select: vi.fn(), from: vi.fn(), where: vi.fn(), order: vi.fn(), limit: vi.fn(),
  update: vi.fn(), set: vi.fn(), returning: vi.fn(),
}))
vi.mock('./index.js', () => ({ db: { select: m.select, update: m.update, query: { publicProfiles: { findFirst: m.find } } } }))
import { listVisiblePublicProfileRows, updatePublicProfileAtomic } from './public-profiles.js'

beforeEach(() => {
  vi.clearAllMocks()
  m.select.mockReturnValue({ from: m.from })
  m.from.mockReturnValue({ where: m.where })
  m.where.mockReturnValue({ orderBy: m.order })
  m.order.mockReturnValue({ limit: m.limit })
  m.limit.mockResolvedValue([])
  m.update.mockReturnValue({ set: m.set })
  m.set.mockReturnValue({ where: vi.fn().mockReturnValue({ returning: m.returning }) })
  m.returning.mockResolvedValue([])
})

it('met à jour un profil avec contrôle de concurrence, sans liaison ni ciblage', async () => {
  await updatePublicProfileAtomic('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 1, {
    section: 'team', displayName: 'Ada', roleTitle: null, bioText: null, photoUrl: null,
    photoStorageKey: null, photoAlt: null, updatedByMemberId: '00000000-0000-4000-8000-000000000003', updatedAt: new Date(),
  })
  expect(m.update).toHaveBeenCalledTimes(1)
  expect(m.set).toHaveBeenCalledWith(expect.objectContaining({ bioText: null, revision: expect.anything() }))
})

it('projette une bio texte, sans membre, stockage ni ordre manuel', async () => {
  await listVisiblePublicProfileRows('x', 'team', undefined, 50)
  const fields = Object.keys(m.select.mock.calls[0][0])
  expect(fields).toEqual(['id', 'ludoId', 'section', 'displayName', 'roleTitle', 'bioText', 'photoUrl', 'photoAlt'])
  expect(m.limit).toHaveBeenCalledWith(50)
})
