import { PgDialect } from 'drizzle-orm/pg-core'
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
  mocks.findMany.mockResolvedValue([])
  mocks.select.mockReturnValue({ from: mocks.from })
  mocks.from.mockReturnValue({ where: mocks.where })
  mocks.where.mockReturnValue({ orderBy: mocks.orderBy })
  mocks.orderBy.mockReturnValue({ limit: mocks.limit })
  mocks.limit.mockResolvedValue([])
})

describe('updatePublicActivityAtomic', () => {
  it('conditionne les trois set-diff au CAS parent', async () => {
    await expect(
      updatePublicActivityAtomic(
        ID,
        LUDO,
        3,
        {
          slug: 'atelier',
          title: 'Atelier',
          summary: 'Résumé',
          body: 'Corps',
          location: null,
          type: 'recurring',
          recurrenceRule: 'FREQ=WEEKLY',
          updatedByMemberId: '00000000-0000-4000-8000-000000000003',
          updatedAt: new Date('2026-08-05T12:00:00Z'),
        },
        ['00000000-0000-4000-8000-000000000004'],
        [{ startsAt: new Date('2026-09-01T10:00:00Z'), endsAt: null }],
        [{ excludedAt: new Date('2026-09-08T10:00:00Z'), reason: 'Fermé' }],
      ),
    ).resolves.toBeUndefined()

    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).sql
    expect(query).toMatch(/AND revision = \$\d+/)
    expect(query).toContain('desired_sites')
    expect(query).toContain('desired_dates')
    expect(query).toContain('desired_exceptions')
    expect(query).toContain('::timestamptz')
    expect(query).not.toContain('::timestamp,')
    expect(query.match(/USING updated/g)).toHaveLength(3)
    expect(query).toContain('ON CONFLICT (activity_id, site_id) DO NOTHING')
    expect(query).toContain('ON CONFLICT (activity_id, starts_at) DO UPDATE')
    expect(query).toContain('ON CONFLICT (activity_id, excluded_at) DO UPDATE')
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })
})

describe('projection publique', () => {
  it('exclut body et membres, filtre active/published/site actif, et limite en base', async () => {
    await listVisiblePublicActivitySummaryRows(LUDO, ID, 'active', 20)
    const projection = mocks.select.mock.calls[0][0]
    expect(projection).not.toHaveProperty('body')
    expect(projection).not.toHaveProperty('author')
    expect(projection).not.toHaveProperty('exceptions')
    expect(projection).toHaveProperty('dates')
    const datesSql = new PgDialect().sqlToQuery(projection.dates).sql
    expect(datesSql).toContain('LIMIT 3')
    expect(datesSql).toContain('jsonb_agg')
    expect(mocks.limit).toHaveBeenCalledWith(20)
    const where = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).sql
    expect(where).toContain('active.is_active = true')
    expect(where).toContain('public_activities"."status" = $')
    expect(where).toContain('public_activities"."lifecycle" = $')
  })
})
