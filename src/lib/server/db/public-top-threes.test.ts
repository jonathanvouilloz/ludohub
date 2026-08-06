import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
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
    batch: mocks.batch,
    execute: mocks.execute,
    select: mocks.select,
    query: { publicTopThrees: { findFirst: mocks.findFirst } },
  },
}))

import {
  listVisiblePublicTopThreeSummaryRows,
  selectPublicTopThreeHomepageAtomic,
  updatePublicTopThreeAtomic,
} from './public-top-threes.js'
import { publicTopThrees } from '../schema.js'

// Limite volontaire : neon-http ne permet pas de transaction callback locale et ce test
// n'ouvre pas deux connexions PostgreSQL. Il vérifie donc le batch transactionnel réellement
// utilisé en production, son ordre, ses gardes SQL et ses issues stale/contrainte.
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
      'isHomepage',
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

  it('ordonne une vraie transaction wire: verrou, candidat FOR UPDATE, clear conditionnel, sélection', async () => {
    mocks.batch.mockResolvedValue([{ rows: [{}] }, { rows: [] }, { rows: [] }, { rows: [] }])
    await expect(
      selectPublicTopThreeHomepageAtomic(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        4,
        new Date('2026-08-05T12:00:00Z'),
      ),
    ).resolves.toBeUndefined()
    expect(mocks.batch).toHaveBeenCalledOnce()
    const queries = mocks.execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query).sql)
    expect(queries).toHaveLength(4)
    expect(queries[0]).toContain('pg_advisory_xact_lock')
    expect(queries[1]).toContain('FOR UPDATE')
    expect(queries[1]).toMatch(/candidate\.status = 'published'/)
    expect(queries[1]).toMatch(/candidate\.revision = \$/)
    expect(queries[1]).toContain('candidate.is_homepage = false')
    expect(queries[2]).toContain('previous.is_homepage = true')
    expect(queries[2]).toContain('EXISTS')
    expect(queries[2]).toMatch(/candidate\.status = 'published'/)
    expect(queries[3]).toContain('SET is_homepage = true')
    expect(queries[3]).toMatch(/candidate\.revision = \$/)
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('ne relit ni ne considère sélectionné un candidat stale après le verrou', async () => {
    mocks.batch.mockResolvedValue([{ rows: [{}] }, { rows: [] }, { rows: [] }, { rows: [] }])
    await expect(
      selectPublicTopThreeHomepageAtomic(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        4,
        new Date('2026-08-05T12:00:00Z'),
      ),
    ).resolves.toBeUndefined()
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('relit le candidat seulement après une sélection transactionnelle réussie', async () => {
    mocks.batch.mockResolvedValue([
      { rows: [{}] },
      { rows: [{ id: 'top-a' }] },
      { rows: [{ id: 'top-old' }] },
      { rows: [{ id: 'top-a' }] },
    ])
    mocks.findFirst.mockResolvedValue({ id: 'top-a', isHomepage: true })
    await expect(
      selectPublicTopThreeHomepageAtomic(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        4,
        new Date('2026-08-05T12:00:00Z'),
      ),
    ).resolves.toEqual({ id: 'top-a', isHomepage: true })
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything() }),
    )
  })

  it.each(['23505', '23514'])('traduit la violation %s en conflit contrôlé', async (code) => {
    mocks.batch.mockRejectedValue({ code })
    await expect(
      selectPublicTopThreeHomepageAtomic(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        4,
        new Date('2026-08-05T12:00:00Z'),
      ),
    ).resolves.toBeUndefined()
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('borne aussi les valeurs JSON dans le CHECK PostgreSQL', () => {
    const constraint = getTableConfig(publicTopThrees).checks.find(
      (entry) => entry.name === 'public_top_threes_games_shape_check',
    )
    expect(constraint).toBeDefined()
    const checkSql = new PgDialect().sqlToQuery(constraint!.value).sql
    expect(checkSql).toContain('jsonb_array_length')
    expect(checkSql).toContain('like_regex "^\\\\s*.{0,159}\\\\S\\\\s*$" flag "s"')
    expect(checkSql).toContain('like_regex "^\\\\s*.*\\\\S\\\\s*$" flag "s"')
  })

  it('garantit une seule sélection accueil publiée par tenant', () => {
    const config = getTableConfig(publicTopThrees)
    expect(config.checks.map((entry) => entry.name)).toContain(
      'public_top_threes_homepage_published_check',
    )
    expect(config.indexes.map((entry) => entry.config.name)).toContain(
      'public_top_threes_one_homepage_per_ludo_idx',
    )
  })
})
