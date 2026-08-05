import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('./index.js', () => ({
  db: {
    execute: mocks.execute,
    query: { publicAnnouncements: { findFirst: mocks.findFirst } },
  },
}))

import { updatePublicAnnouncementAtomic } from './public-announcements.js'

describe('updatePublicAnnouncementAtomic', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['une liste explicite', ['00000000-0000-0000-0000-000000000004'], /VALUES \(\$\d+::uuid\)/],
    ['le ciblage global', [], /SELECT null::uuid AS site_id WHERE false/],
  ])(
    'synchronise par différence pour %s et ne touche rien lorsque le CAS parent est perdu',
    async (_label, siteIds, desiredSql) => {
      mocks.execute.mockResolvedValue({ rows: [] })

      await expect(
        updatePublicAnnouncementAtomic(
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          4,
          {
            title: 'Titre',
            message: 'Message',
            updatedByMemberId: '00000000-0000-0000-0000-000000000003',
            updatedAt: new Date('2026-08-05T12:00:00Z'),
          },
          siteIds,
        ),
      ).resolves.toBeUndefined()

      expect(mocks.execute).toHaveBeenCalledTimes(1)
      expect(mocks.findFirst).not.toHaveBeenCalled()

      const statement = mocks.execute.mock.calls[0][0]
      const query = new PgDialect().sqlToQuery(statement)
      expect(query.sql).toMatch(/AND revision = \$\d+/)
      expect(query.sql).toMatch(desiredSql)
      expect(query.sql).toContain('DELETE FROM public_announcement_sites AS existing')
      expect(query.sql).toContain('USING updated')
      expect(query.sql).toContain('AND NOT EXISTS')
      expect(query.sql).toContain('FROM updated')
      expect(query.sql).toContain('CROSS JOIN desired')
      expect(query.sql).toContain('ON CONFLICT (announcement_id, site_id) DO NOTHING')
    },
  )
})
