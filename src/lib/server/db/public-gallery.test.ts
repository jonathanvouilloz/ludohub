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
  db: {
    execute: m.execute,
    select: m.select,
    query: { publicGalleryImages: { findFirst: m.find } },
  },
}))
import { listVisiblePublicGalleryRows, updatePublicGalleryAtomic } from './public-gallery.js'
beforeEach(() => {
  m.execute.mockResolvedValue({ rows: [] })
  m.select.mockReturnValue({ from: m.from })
  m.from.mockReturnValue({ where: m.where })
  m.where.mockReturnValue({ orderBy: m.order })
  m.order.mockReturnValue({ limit: m.limit })
  m.limit.mockResolvedValue([])
})
it('CAS + set-diff galerie', async () => {
  await updatePublicGalleryAtomic(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    1,
    {
      caption: null,
      alt: null,
      sortOrder: 0,
      imageUrl: null,
      imageStorageKey: null,
      updatedByMemberId: '00000000-0000-4000-8000-000000000003',
      updatedAt: new Date(),
    },
    [],
  )
  const q = new PgDialect().sqlToQuery(m.execute.mock.calls[0][0]).sql
  expect(q).toContain('revision=revision+1')
  expect(q).toContain('USING updated')
  expect(q).toContain('ON CONFLICT(image_id,site_id)')
})
it('projection sans storage/membres bornée', async () => {
  await listVisiblePublicGalleryRows('x', undefined, 20)
  expect(Object.keys(m.select.mock.calls[0][0])).toEqual([
    'id',
    'ludoId',
    'caption',
    'alt',
    'sortOrder',
    'imageUrl',
    'publishedAt',
  ])
  expect(m.limit).toHaveBeenCalledWith(20)
})
