import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  findFirst: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('./index.js', () => ({
  db: {
    execute: mocks.execute,
    select: mocks.select,
    query: { publicNews: { findFirst: mocks.findFirst } },
  },
}))

import { listVisiblePublicNewsSummaryRows, updatePublicNewsAtomic } from './public-news.js'

describe('updatePublicNewsAtomic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.select.mockReturnValue({ from: mocks.from })
    mocks.from.mockReturnValue({ where: mocks.where })
    mocks.where.mockReturnValue({ orderBy: mocks.orderBy })
    mocks.orderBy.mockReturnValue({ limit: mocks.limit })
    mocks.limit.mockResolvedValue([])
  })

  it.each([
    ['cibles explicites', ['00000000-0000-0000-0000-000000000004'], /VALUES \(\$\d+::uuid\)/],
    ['tous les lieux', [], /SELECT null::uuid AS site_id WHERE false/],
  ])(
    'garde la synchronisation set-diff derrière le CAS pour %s',
    async (_label, siteIds, desired) => {
      mocks.execute.mockResolvedValue({ rows: [] })
      await expect(
        updatePublicNewsAtomic(
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          2,
          {
            slug: 'actualite',
            title: 'Titre',
            summary: 'Résumé',
            body: 'Corps',
            imageUrl: null,
            imageStorageKey: null,
            imageAlt: null,
            updatedByMemberId: '00000000-0000-0000-0000-000000000003',
            updatedAt: new Date('2026-08-05T12:00:00Z'),
          },
          siteIds,
        ),
      ).resolves.toBeUndefined()

      expect(mocks.execute).toHaveBeenCalledTimes(1)
      expect(mocks.findFirst).not.toHaveBeenCalled()
      const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).sql
      expect(query).toMatch(/AND revision = \$\d+/)
      expect(query).toMatch(desired)
      expect(query).toContain('USING updated')
      expect(query).toContain('AND NOT EXISTS')
      expect(query).toContain('ON CONFLICT (news_id, site_id) DO NOTHING')
    },
  )

  it('projette seulement le résumé public et impose la limite en base', async () => {
    await listVisiblePublicNewsSummaryRows(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      20,
    )

    const projection = mocks.select.mock.calls[0][0]
    expect(Object.keys(projection)).toEqual([
      'id',
      'ludoId',
      'slug',
      'title',
      'summary',
      'imageUrl',
      'imageAlt',
      'publishedAt',
    ])
    expect(projection).not.toHaveProperty('body')
    expect(projection).not.toHaveProperty('imageStorageKey')
    expect(mocks.limit).toHaveBeenCalledWith(20)

    const whereSql = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).sql
    expect(whereSql).toContain('active.is_active = true')
    expect(whereSql).toContain('NOT EXISTS')
    expect(whereSql).toContain('target.site_id = active.id')
  })
})
