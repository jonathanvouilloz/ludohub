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
  db: { execute: m.execute, select: m.select, query: { publicDocuments: { findFirst: m.find } } },
}))
import {
  listVisiblePublicDocumentSummaryRows,
  updatePublicDocumentAtomic,
} from './public-documents.js'
beforeEach(() => {
  vi.clearAllMocks()
  m.select.mockReturnValue({ from: m.from })
  m.from.mockReturnValue({ where: m.where })
  m.where.mockReturnValue({ orderBy: m.order })
  m.order.mockReturnValue({ limit: m.limit })
  m.limit.mockResolvedValue([])
  m.execute.mockResolvedValue({ rows: [] })
})
describe('documents DB', () => {
  it('synchronise les cibles atomiquement derrière le CAS', async () => {
    await updatePublicDocumentAtomic(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      3,
      {
        slug: 'mission',
        kind: 'mission',
        title: 'Mission',
        summary: null,
        bodyMarkdown: 'Texte',
        year: null,
        pdfUrl: null,
        pdfStorageKey: null,
        pdfFileName: null,
        updatedByMemberId: '00000000-0000-4000-8000-000000000003',
        updatedAt: new Date(),
      },
      [],
    )
    const sql = new PgDialect().sqlToQuery(m.execute.mock.calls[0][0]).sql
    expect(sql).toContain('SELECT null::uuid AS site_id WHERE false')
    expect(sql).toContain('revision=revision+1')
    expect(sql).toContain('USING updated')
    expect(sql).toContain('ON CONFLICT(document_id,site_id) DO NOTHING')
  })
  it('projection publique exclut body/storage/membres et borne en base', async () => {
    await listVisiblePublicDocumentSummaryRows(
      '00000000-0000-4000-8000-000000000001',
      undefined,
      20,
    )
    const fields = Object.keys(m.select.mock.calls[0][0])
    expect(fields).toEqual([
      'id',
      'ludoId',
      'slug',
      'kind',
      'title',
      'summary',
      'year',
      'pdfUrl',
      'pdfFileName',
      'publishedAt',
    ])
    expect(fields).not.toContain('pdfStorageKey')
    expect(fields).not.toContain('bodyMarkdown')
    expect(m.limit).toHaveBeenCalledWith(20)
  })
})
