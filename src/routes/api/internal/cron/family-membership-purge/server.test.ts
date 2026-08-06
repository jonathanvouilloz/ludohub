import { beforeEach, describe, expect, it, vi } from 'vitest'
const privateEnv = vi.hoisted(() => ({ CRON_SECRET: 'secret-long-value' }))
const purge = vi.hoisted(() => vi.fn())
vi.mock('$env/dynamic/private', () => ({ env: privateEnv }))
vi.mock('$lib/server/services/family-registrations.js', () => ({ purgeDueFamilySubmissions: purge }))
import { GET, POST } from './+server.js'
const event = (secret?: string) => ({ request: new Request('https://app.test/api/internal/cron/family-membership-purge', { method: 'POST', headers: secret ? { authorization: `Bearer ${secret}` } : {} }) }) as never
beforeEach(() => { vi.clearAllMocks(); purge.mockResolvedValue({ purged: 12, batches: 2, hasMore: false }) })
describe('cron de purge familiale', () => {
  it.each([undefined, 'wrong'])('refuse un secret absent ou faux', async (secret) => { const response = await POST(event(secret)); expect(response.status).toBe(401); expect(purge).not.toHaveBeenCalled() })
  it('lance le job borné avec le bon secret, sans cache', async () => { const response = await GET(event('secret-long-value')); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store'); await expect(response.json()).resolves.toEqual({ purged: 12, batches: 2, hasMore: false }) })
  it('propage un échec pour que le planificateur retente', async () => { purge.mockRejectedValueOnce(new Error('database failure')); await expect(POST(event('secret-long-value'))).rejects.toThrow('database failure') })
})
