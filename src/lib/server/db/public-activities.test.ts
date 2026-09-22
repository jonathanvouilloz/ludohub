import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), select: vi.fn(), from: vi.fn(),
  where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
}))
vi.mock('./index.js', () => ({
  db: { execute: mocks.execute, select: mocks.select, query: { publicActivities: { findMany: mocks.findMany, findFirst: mocks.findFirst } } },
}))
import { listVisiblePublicActivitySummaryRows, updatePublicActivityAtomic } from './public-activities.js'

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
    await updatePublicActivityAtomic(ID, LUDO, 3, {
      slug: 'atelier', title: 'Atelier', summary: 'Résumé', body: 'Les détails dans ce texte.',
      location: null, type: 'recurring', updatedByMemberId: '00000000-0000-4000-8000-000000000003', updatedAt: new Date(),
    }, ['00000000-0000-4000-8000-000000000004'])
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
    expect(projection).not.toHaveProperty('body')
    expect(projection).not.toHaveProperty('dates')
    expect(projection).not.toHaveProperty('exceptions')
    expect(mocks.limit).toHaveBeenCalledWith(20)
  })
})
