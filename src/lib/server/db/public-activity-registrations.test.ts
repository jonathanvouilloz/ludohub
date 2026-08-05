import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  batch: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
}))
vi.mock('./index.js', () => ({
  db: {
    execute: mocks.execute,
    batch: mocks.batch,
    query: {
      publicActivityRegistrations: { findFirst: mocks.findFirst, findMany: mocks.findMany },
    },
  },
}))

import {
  getPublicActivityRegistrationRowForLudo,
  insertPublicActivityRegistrationAtomic,
  listPublicActivityRegistrationRows,
} from './public-activity-registrations.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.execute.mockImplementation((query) => ({ query }))
  mocks.batch.mockResolvedValue([{ rows: [] }, { rows: [] }])
  mocks.findMany.mockResolvedValue([])
  mocks.findFirst.mockResolvedValue(undefined)
})

describe('écriture atomique d’une inscription', () => {
  it('sérialise la capacité, compte seulement les places réservées et crée le reçu outbox', async () => {
    await insertPublicActivityRegistrationAtomic({
      id: '10000000-0000-4000-8000-000000000001',
      ludoId: '20000000-0000-4000-8000-000000000001',
      activityId: '30000000-0000-4000-8000-000000000001',
      idempotencyKeyHash: 'a'.repeat(64),
      requestFingerprint: 'b'.repeat(64),
      contactName: 'Ada',
      email: 'ada@example.ch',
      phone: null,
      participantCount: 2,
      message: null,
      createdAt: new Date('2026-08-05T12:00:00Z'),
      updatedAt: new Date('2026-08-05T12:00:00Z'),
    })
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    expect(mocks.execute).toHaveBeenCalledTimes(2)
    const lock = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).sql
    const write = new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]).sql
    expect(lock).toContain('pg_advisory_xact_lock')
    expect(lock).toContain('hashtextextended')
    expect(write).not.toContain('pg_advisory_xact_lock')
    expect(write).toContain("registration.status IN ('received', 'confirmed')")
    expect(write).toContain("THEN 'waitlisted'::public_activity_registration_status")
    expect(write).toContain('request_fingerprint')
    expect(write).toContain('receipt_status')
    expect(write).toContain("activity.status = 'published'")
    expect(write).toContain("activity.lifecycle = 'active'")
    expect(write).toContain('activity.registration_enabled = true')
    expect(write).toContain('INSERT INTO public_activity_registration_outbox')
    expect(write).toContain("'pending'")
    expect(write).toContain('ON CONFLICT (ludo_id, idempotency_key_hash) DO NOTHING')
  })

  it('propage l’échec du statement d’écriture pour laisser db.batch tout rollback', async () => {
    mocks.batch.mockRejectedValueOnce(new Error('outbox failure'))
    await expect(
      insertPublicActivityRegistrationAtomic({
        id: '10000000-0000-4000-8000-000000000001',
        ludoId: '20000000-0000-4000-8000-000000000001',
        activityId: '30000000-0000-4000-8000-000000000001',
        idempotencyKeyHash: 'a'.repeat(64),
        requestFingerprint: 'b'.repeat(64),
        contactName: 'Ada',
        email: 'ada@example.ch',
        participantCount: 1,
      }),
    ).rejects.toThrow('outbox failure')
    expect(mocks.batch).toHaveBeenCalledTimes(1)
  })
})

describe('projection de gestion', () => {
  it('ne demande ni relation membre/outbox ni colonnes privées inutiles', async () => {
    await listPublicActivityRegistrationRows('ludo-a', undefined, undefined, 100)
    await getPublicActivityRegistrationRowForLudo('registration-a', 'ludo-a')
    for (const config of [mocks.findMany.mock.calls[0][0], mocks.findFirst.mock.calls[0][0]]) {
      expect(config.with).toEqual({
        activity: { columns: { id: true, title: true, slug: true } },
      })
      expect(config.with).not.toHaveProperty('handledBy')
      expect(config.with).not.toHaveProperty('outbox')
      expect(config.columns).not.toHaveProperty('idempotencyKeyHash')
      expect(config.columns).not.toHaveProperty('receiptStatus')
      expect(config.columns).not.toHaveProperty('handledByMemberId')
    }
  })
})
