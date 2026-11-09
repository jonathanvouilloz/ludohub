import { PgDialect } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/neon-http'
import { publicActivities } from '../schema.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  findMany: vi.fn(),
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
    query: { publicActivities: { findMany: mocks.findMany, findFirst: mocks.findFirst } },
  },
}))
import {
  listVisiblePublicActivitySummaryRows,
  updatePublicActivityAtomic,
} from './public-activities.js'

const ID = '00000000-0000-4000-8000-000000000001'
const LUDO = '00000000-0000-4000-8000-000000000002'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.execute.mockResolvedValue({ rows: [] })
  mocks.select.mockReturnValue({ from: mocks.from })
  mocks.from.mockReturnValue({ where: mocks.where })
  mocks.where.mockReturnValue({ orderBy: mocks.orderBy })
  mocks.orderBy.mockReturnValue({ limit: mocks.limit })
  mocks.limit.mockResolvedValue([])
})

describe('activité simplifiée en base', () => {
  it('met à jour le contenu et le ciblage derrière le CAS, sans dates ni exceptions', async () => {
    await updatePublicActivityAtomic(
      ID,
      LUDO,
      3,
      {
        slug: 'atelier',
        title: 'Atelier',
        summary: 'Résumé',
        body: 'Les détails dans ce texte.',
        location: null,
        type: 'recurring',
        updatedByMemberId: '00000000-0000-4000-8000-000000000003',
        updatedAt: new Date(),
      },
      ['00000000-0000-4000-8000-000000000004'],
    )
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).sql
    expect(query).toMatch(/AND revision = \$\d+/)
    expect(query).toContain('desired_sites')
    expect(query).toContain('USING updated')
    expect(query).not.toMatch(/desired_dates|desired_exceptions|starts_at|excluded_at/)
  })

  it('expose une fiche publique sans corps ni calendrier structuré', async () => {
    await listVisiblePublicActivitySummaryRows(LUDO, ID, 'active', 20)
    const projection = mocks.select.mock.calls[0][0]
    expect(projection).toHaveProperty('type')
    const sitesSql = new PgDialect().sqlToQuery(projection.sites).sql
    expect(sitesSql).toContain('active.ludo_id = "public_activities"."ludo_id"')
    expect(sitesSql).toContain('active.is_active = true')
    expect(sitesSql).toContain('NOT EXISTS')
    expect(sitesSql).toContain('target.site_id = active.id')
    expect(sitesSql).toContain("'slug', active.slug")
    expect(sitesSql).not.toContain('active.id = $')
    expect(projection).not.toHaveProperty('body')
    expect(projection).not.toHaveProperty('dates')
    expect(projection).not.toHaveProperty('exceptions')
    expect(mocks.limit).toHaveBeenCalledWith(20)
  })

  it.each(['active', 'archived'] as const)(
    'conserve les corrélations de tenant et ciblage dans le SELECT réellement compilé (%s)',
    async (lifecycle) => {
      await listVisiblePublicActivitySummaryRows(LUDO, ID, lifecycle, 20)
      const projection = mocks.select.mock.calls[0][0]
      const { sql: query, params } = drizzle
        .mock()
        .select(projection)
        .from(publicActivities)
        .where(mocks.where.mock.calls[0][0])
        .toSQL()
      expect(query).toContain('active.ludo_id = "public_activities"."ludo_id"')
      expect(query).toContain('any_target.activity_id = "public_activities"."id"')
      expect(query).toContain('any_target.ludo_id = "public_activities"."ludo_id"')
      expect(query).toContain('target.activity_id = "public_activities"."id"')
      expect(query).toContain('target.ludo_id = "public_activities"."ludo_id"')
      expect(query).toContain('target.site_id = active.id')
      expect(query).not.toMatch(/active\.ludo_id = "ludo_id"|activity_id = "id"/)
      expect(params).toContain(LUDO)
      expect(params).toContain(ID)
      expect(params).toContain(lifecycle)
    },
  )
})
