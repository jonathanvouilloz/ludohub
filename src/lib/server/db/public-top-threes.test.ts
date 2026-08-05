import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
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
    query: { publicTopThrees: { findFirst: mocks.findFirst } },
  },
}))

import {
  listVisiblePublicTopThreeSummaryRows,
  updatePublicTopThreeAtomic,
} from './public-top-threes.js'
import { publicTopThrees } from '../schema.js'

describe('public-top-threes DB', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.select.mockReturnValue({ from: mocks.from })
    mocks.from.mockReturnValue({ where: mocks.where })
    mocks.where.mockReturnValue({ orderBy: mocks.orderBy })
    mocks.orderBy.mockReturnValue({ limit: mocks.limit })
    mocks.limit.mockResolvedValue([])
  })

  it.each([
    [['00000000-0000-4000-8000-000000000004'], /VALUES \(\$\d+::uuid\)/],
    [[], /SELECT null::uuid AS site_id WHERE false/],
  ])('place le set-diff des cibles derrière le CAS', async (siteIds, desired) => {
    mocks.execute.mockResolvedValue({ rows: [] })
    await expect(
      updatePublicTopThreeAtomic(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        4,
        {
          slug: 'jeux-cooperatifs',
          theme: 'Jeux coopératifs',
          games: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
          updatedByMemberId: '00000000-0000-4000-8000-000000000003',
          updatedAt: new Date('2026-08-05T12:00:00Z'),
        },
        siteIds,
      ),
    ).resolves.toBeUndefined()

    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).sql
    expect(query).toMatch(/AND revision = \$\d+/)
    expect(query).toMatch(desired)
    expect(query).toContain('USING updated')
    expect(query).toContain('NOT EXISTS')
    expect(query).toContain('ON CONFLICT (top_three_id, site_id) DO NOTHING')
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('projette trois objets nom-only dans leur ordre et borne en base', async () => {
    await listVisiblePublicTopThreeSummaryRows(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      20,
    )
    const projection = mocks.select.mock.calls[0][0]
    expect(Object.keys(projection)).toEqual([
      'id',
      'ludoId',
      'slug',
      'theme',
      'games',
      'publishedAt',
    ])
    const gamesSql = new PgDialect().sqlToQuery(projection.games).sql
    expect(gamesSql).toContain("jsonb_build_object('name'")
    expect(gamesSql).toContain('WITH ORDINALITY')
    expect(gamesSql).toContain('ORDER BY game.ordinality')
    expect(gamesSql).not.toContain('description')
    expect(mocks.limit).toHaveBeenCalledWith(20)

    const whereSql = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).sql
    expect(whereSql).toContain('active.is_active = true')
    expect(whereSql).toContain('target.site_id = active.id')
  })

  it('borne aussi les valeurs JSON dans le CHECK PostgreSQL', () => {
    const constraint = getTableConfig(publicTopThrees).checks.find(
      (entry) => entry.name === 'public_top_threes_games_shape_check',
    )
    expect(constraint).toBeDefined()
    const checkSql = new PgDialect().sqlToQuery(constraint!.value).sql
    expect(checkSql).toContain('jsonb_array_length')
    expect(checkSql).toContain('like_regex "^\\\\s*.{0,159}\\\\S\\\\s*$" flag "s"')
    expect(checkSql).toContain('like_regex "^\\\\s*.{0,1999}\\\\S\\\\s*$" flag "s"')
  })
})
