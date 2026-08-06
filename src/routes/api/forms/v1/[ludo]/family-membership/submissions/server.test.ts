import { beforeEach, describe, expect, it, vi } from 'vitest'
const privateEnv = vi.hoisted(() => ({ PUBLIC_API_ALLOWED_ORIGINS: 'https://site.test' }))
const submit = vi.hoisted(() => vi.fn())
const rate = vi.hoisted(() => vi.fn())
vi.mock('$env/dynamic/private', () => ({ env: privateEnv }))
vi.mock('$lib/server/services/rate-limit.js', () => ({ checkRateLimit: rate }))
vi.mock('$lib/server/services/family-registrations.js', () => {
  class FamilyRegistrationServiceError extends Error { constructor(message: string, public readonly code: 'invalid' | 'not_found' | 'conflict' = 'invalid') { super(message) } }
  return { FamilyRegistrationServiceError, submitPublicFamilyMembership: submit }
})
import { POST } from './+server.js'
import { FamilyRegistrationServiceError } from '$lib/server/services/family-registrations.js'
const body = { firstName: 'Ada', lastName: 'Lovelace', website: '' }
function request(origin = 'https://app.test', payload: unknown = body) { return new Request('https://app.test/api/forms/v1/demo/family-membership/submissions', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': 'request-0000000001' }, body: JSON.stringify(payload) }) }
beforeEach(() => { vi.clearAllMocks(); rate.mockReturnValue({ ok: true }); submit.mockResolvedValue({ receiptId: 'receipt', submittedAt: new Date('2026-08-06T10:00:00Z'), created: true }) })
describe('POST adhésion familiale', () => {
  it.each([['same-origin', 'https://app.test'], ['allowlist externe', 'https://site.test']])('autorise %s', async (_label, origin) => { const response = await POST({ params: { ludo: 'demo' }, request: request(origin) } as never); expect(response.status).toBe(201); expect(response.headers.get('access-control-allow-origin')).toBe(origin) })
  it('refuse une origine externe non autorisée', async () => { const response = await POST({ params: { ludo: 'demo' }, request: request('https://evil.test') } as never); expect(response.status).toBe(403); expect(submit).not.toHaveBeenCalled() })
  it('renvoie 200 pour un rejeu exact et 409 pour une clé réutilisée autrement', async () => { submit.mockResolvedValueOnce({ receiptId: 'receipt', submittedAt: new Date(), created: false }); expect((await POST({ params: { ludo: 'demo' }, request: request() } as never)).status).toBe(200); submit.mockRejectedValueOnce(new FamilyRegistrationServiceError('conflict', 'conflict')); expect((await POST({ params: { ludo: 'demo' }, request: request() } as never)).status).toBe(409) })
  it('absorbe le honeypot', async () => { const response = await POST({ params: { ludo: 'demo' }, request: request('https://app.test', { ...body, website: 'robot' }) } as never); expect(response.status).toBe(202); expect(submit).not.toHaveBeenCalled() })
  it('rejette un content-length supérieur à 32 Kio', async () => { const oversized = new Request('https://app.test/api/forms/v1/demo/family-membership/submissions', { method: 'POST', headers: { origin: 'https://app.test', 'content-length': '32769' }, body: '{}' }); const response = await POST({ params: { ludo: 'demo' }, request: oversized } as never); expect(response.status).toBe(413); expect(submit).not.toHaveBeenCalled() })
})
