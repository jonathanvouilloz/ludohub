import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ execute: vi.fn(), batch: vi.fn(), findFirst: vi.fn() }))
vi.mock('./index.js', () => ({ db: { execute: mocks.execute, batch: mocks.batch, query: { familyRegistrationForms: { findFirst: mocks.findFirst }, familySubmissionReceipts: { findFirst: mocks.findFirst } } } }))
import { purgeDueFamilySubmissionsRow, recordFamilyPaymentAtomic } from './family-registrations.js'
const sql = (query: unknown) => new PgDialect().sqlToQuery(query as never).sql
beforeEach(() => { vi.clearAllMocks(); mocks.execute.mockResolvedValue({ rows: [] }) })

describe('paiement hors ligne', () => {
  it('verrouille par tenant/révision, exige processed et une méthode autorisée par la version', async () => {
    await recordFamilyPaymentAtomic({ id: '10000000-0000-4000-8000-000000000001', ludoId: '20000000-0000-4000-8000-000000000001', expectedRevision: 2, memberId: '30000000-0000-4000-8000-000000000001', paymentMethod: 'twint', now: new Date() })
    const query = sql(mocks.execute.mock.calls[0][0])
    expect(query).toContain("submission.status='processed'")
    expect(query).toContain('submission.revision=')
    expect(query).toContain('version.allows_twint')
    expect(query).toContain('version.allows_cash')
    expect(query).toContain('version.id=submission.form_version_id')
  })
})

describe('purge PII et agrégat', () => {
  it('sélectionne uniquement les lignes avec ledger, agrège puis marque et supprime dans un statement atomique', async () => {
    await purgeDueFamilySubmissionsRow(new Date('2026-09-06T00:00:00Z'), 100)
    const query = sql(mocks.execute.mock.calls[0][0])
    expect(query).toContain('JOIN family_submission_receipts receipt')
    expect(query).toContain('receipt.purged_at IS NULL')
    expect(query.indexOf('INSERT INTO family_processing_daily_stats')).toBeLessThan(query.indexOf('UPDATE family_submission_receipts'))
    expect(query.indexOf('UPDATE family_submission_receipts')).toBeLessThan(query.indexOf('DELETE FROM family_registration_submissions'))
    expect(query).toContain("submission.status='processed'")
    expect(query).not.toContain("submission.status='new'")
  })

  it('propage tout échec pour laisser la transaction du statement rollback', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('aggregate failure'))
    await expect(purgeDueFamilySubmissionsRow(new Date(), 10)).rejects.toThrow('aggregate failure')
  })
})
