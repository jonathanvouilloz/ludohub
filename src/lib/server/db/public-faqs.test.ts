import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  db: { execute: m.execute, select: m.select, query: { publicFaqs: { findFirst: m.find } } },
}))
import { listVisiblePublicFaqRows, updatePublicFaqAtomic } from './public-faqs.js'
beforeEach(() => {
  vi.clearAllMocks()
  m.select.mockReturnValue({ from: m.from })
  m.from.mockReturnValue({ where: m.where })
  m.where.mockReturnValue({ orderBy: m.order })
  m.order.mockReturnValue({ limit: m.limit })
  m.limit.mockResolvedValue([])
  m.execute.mockResolvedValue({ rows: [] })
})
describe('FAQ DB', () => {
  it.each([
    [[], /SELECT null::uuid AS site_id WHERE false/],
    [['00000000-0000-4000-8000-000000000004'], /VALUES \(\$\d+::uuid\)/],
  ])('set-diff reste derrière CAS', async (siteIds, desired) => {
    await updatePublicFaqAtomic(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      2,
      {
        question: 'Q',
        answerMarkdown: 'R',
        category: null,
        sortOrder: 1,
        updatedByMemberId: '00000000-0000-4000-8000-000000000003',
        updatedAt: new Date(),
      },
      siteIds,
    )
    const sql = new PgDialect().sqlToQuery(m.execute.mock.calls[0][0]).sql
    expect(sql).toMatch(desired)
    expect(sql).toContain('revision=revision+1')
    expect(sql).toContain('USING updated')
    expect(sql).toContain('ON CONFLICT(faq_id,site_id) DO NOTHING')
  })
  it('projette, ordonne et borne en SQL', async () => {
    await listVisiblePublicFaqRows('00000000-0000-4000-8000-000000000001', undefined, 100)
    expect(Object.keys(m.select.mock.calls[0][0])).toEqual([
      'id',
      'ludoId',
      'question',
      'answerMarkdown',
      'category',
      'sortOrder',
    ])
    expect(m.order).toHaveBeenCalledTimes(1)
    expect(m.limit).toHaveBeenCalledWith(100)
    const sql = new PgDialect().sqlToQuery(m.where.mock.calls[0][0]).sql
    expect(sql).toContain('active.is_active = true')
  })
})
