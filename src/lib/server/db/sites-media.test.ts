import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  findFirst: vi.fn(),
}))
vi.mock('./index.js', () => ({
  db: { update: mocks.update, query: { ludoSites: { findFirst: mocks.findFirst } } },
}))
import { updateSitePhotoRow, getSitePhotoReferenceRow } from './sites.js'
const SITE = '20000000-0000-4000-8000-000000000001'
const LUDO = '10000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.update.mockReturnValue({ set: mocks.set })
  mocks.set.mockReturnValue({ where: mocks.where })
  mocks.where.mockReturnValue({ returning: mocks.returning })
  mocks.returning.mockResolvedValue([])
})
it.each([null, 'previous.webp'])(
  'photo CAS en base borné au lieu, tenant et référence %s',
  async (previous) => {
    await expect(
      updateSitePhotoRow(SITE, LUDO, previous, {
        photoUrl: null,
        photoStorageKey: null,
        photoAlt: null,
      }),
    ).resolves.toBeUndefined()
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0])
    expect(query.sql).toContain('"ludo_sites"."id" = $1')
    expect(query.sql).toContain('"ludo_sites"."ludo_id" = $2')
    expect(query.sql).toContain('"ludo_sites"."photo_storage_key" IS NOT DISTINCT FROM $3')
    expect(query.params).toEqual([SITE, LUDO, previous])
  },
)
it('la lecture de compensation cible uniquement la référence du lieu et du tenant', async () => {
  mocks.findFirst.mockResolvedValue({ photoStorageKey: 'photo.webp' })
  await expect(getSitePhotoReferenceRow(SITE, LUDO)).resolves.toEqual({
    photoStorageKey: 'photo.webp',
  })
  const input = mocks.findFirst.mock.calls[0][0]
  expect(input.columns).toEqual({ photoStorageKey: true })
  const query = new PgDialect().sqlToQuery(input.where)
  expect(query.params).toEqual([SITE, LUDO])
  expect(query.sql).toContain('"ludo_sites"."id" = $1')
  expect(query.sql).toContain('"ludo_sites"."ludo_id" = $2')
})
