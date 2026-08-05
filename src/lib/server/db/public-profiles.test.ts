import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  execute: vi.fn(),
  find: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}))
vi.mock('./index.js', () => ({
  db: { execute: m.execute, select: m.select, query: { publicProfiles: { findFirst: m.find } } },
}))
import { listVisiblePublicProfileRows, updatePublicProfileAtomic } from './public-profiles.js'
beforeEach(() => {
  m.execute.mockResolvedValue({ rows: [] })
  m.select.mockReturnValue({ from: m.from })
  m.from.mockReturnValue({ where: m.where })
  m.where.mockReturnValue({ orderBy: m.order })
  m.order.mockReturnValue({ limit: m.limit })
  m.limit.mockResolvedValue([])
})
it('CAS + set-diff profils', async () => {
  await updatePublicProfileAtomic(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    1,
    {
      memberId: null,
      section: 'team',
      displayName: 'Ada',
      roleTitle: null,
      bioMarkdown: null,
      sortOrder: 0,
      photoUrl: null,
      photoStorageKey: null,
      photoAlt: null,
      updatedByMemberId: '00000000-0000-4000-8000-000000000003',
      updatedAt: new Date(),
    },
    [],
  )
  const q = new PgDialect().sqlToQuery(m.execute.mock.calls[0][0]).sql
  expect(q).toContain('revision=revision+1')
  expect(q).toContain('USING updated')
  expect(q).toContain('ON CONFLICT(profile_id,site_id)')
})
it('projection publique exclut memberId/storage/membres', async () => {
  await listVisiblePublicProfileRows('x', 'team', undefined, 50)
  const f = Object.keys(m.select.mock.calls[0][0])
  expect(f).toEqual([
    'id',
    'ludoId',
    'section',
    'displayName',
    'roleTitle',
    'bioMarkdown',
    'sortOrder',
    'photoUrl',
    'photoAlt',
  ])
  expect(f).not.toContain('memberId')
  expect(m.limit).toHaveBeenCalledWith(50)
})
