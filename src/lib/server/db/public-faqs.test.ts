import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  execute: vi.fn(), find: vi.fn(), select: vi.fn(), from: vi.fn(), innerJoin: vi.fn(),
  where: vi.fn(), order: vi.fn(), limit: vi.fn(),
}))
vi.mock('./index.js', () => ({ db: { execute: m.execute, select: m.select, query: { publicFaqs: { findFirst: m.find } } } }))
import { listVisiblePublicFaqRows, updatePublicFaqAtomic } from './public-faqs.js'

beforeEach(() => {
  vi.clearAllMocks()
  m.select.mockReturnValue({ from: m.from })
  m.from.mockReturnValue({ innerJoin: m.innerJoin })
  m.innerJoin.mockReturnValue({ where: m.where })
  m.where.mockReturnValue({ orderBy: m.order })
  m.order.mockReturnValue({ limit: m.limit })
  m.limit.mockResolvedValue([])
  m.execute.mockResolvedValue({ rows: [] })
})

describe('FAQ simplifiée en base', () => {
  it('met à jour texte, catégorie et ciblage derrière le CAS', async () => {
    await updatePublicFaqAtomic('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 2, {
      question: 'Q', answerText: 'R', categoryId: '00000000-0000-4000-8000-000000000005',
      updatedByMemberId: '00000000-0000-4000-8000-000000000003', updatedAt: new Date(),
    }, [])
    const query = new PgDialect().sqlToQuery(m.execute.mock.calls[0][0]).sql
    expect(query).toContain('answer_text')
    expect(query).toContain('category_id')
    expect(query).toContain('revision=revision+1')
    expect(query).toContain('USING updated')
  })

  it('projette le texte et la catégorie, dans l’ordre des catégories', async () => {
    await listVisiblePublicFaqRows('00000000-0000-4000-8000-000000000001', undefined, 100)
    expect(Object.keys(m.select.mock.calls[0][0])).toEqual(['id', 'ludoId', 'question', 'answerText', 'category'])
    expect(m.innerJoin).toHaveBeenCalledTimes(1)
    expect(m.limit).toHaveBeenCalledWith(100)
  })
})
