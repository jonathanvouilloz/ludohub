import { beforeEach, describe, expect, it, vi } from 'vitest'

const { submit, cors, rate } = vi.hoisted(() => ({ submit: vi.fn(), cors: vi.fn(), rate: vi.fn() }))
vi.mock('$lib/server/services/public-contacts.js', async () => {
  class PublicContactServiceError extends Error {
    constructor(
      message: string,
      public readonly code: 'invalid' | 'not_found' | 'conflict' = 'invalid',
    ) {
      super(message)
    }
  }
  return { PublicContactServiceError, submitPublicContactByLudoSlug: submit }
})
vi.mock('$lib/server/public-http.js', () => ({ publicCorsHeaders: cors }))
vi.mock('$lib/server/services/rate-limit.js', () => ({ checkRateLimit: rate }))
import { POST } from './+server.js'

const body = {
  recipient: 'secheron',
  name: 'Ada',
  email: 'ada@example.ch',
  subject: 'Question',
  message: 'Bonjour',
}
function makeRequest(payload: unknown = body) {
  return new Request('https://api.test/api/public/contact/v1/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'request-00000001' },
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  cors.mockReturnValue(new Headers())
  rate.mockReturnValue({ ok: true })
  submit.mockResolvedValue({ receiptId: 'receipt-a', created: true })
})

describe('POST /api/public/contact/v1/[ludo]', () => {
  it('transmet destinataire et sujet sans renvoyer le message', async () => {
    const response = await POST({ params: { ludo: 'demo' }, request: makeRequest() } as never)
    expect(response.status).toBe(201)
    expect(submit).toHaveBeenCalledWith('demo', 'request-00000001', { ...body, phone: undefined })
    expect(await response.json()).toEqual({ accepted: true, receiptId: 'receipt-a' })
  })

  it('absorbe le honeypot sans stocker', async () => {
    const response = await POST({
      params: { ludo: 'demo' },
      request: makeRequest({ ...body, website: 'spam' }),
    } as never)
    expect(response.status).toBe(202)
    expect(submit).not.toHaveBeenCalled()
  })

  it('applique le quota avant le traitement', async () => {
    rate.mockReturnValueOnce({ ok: false, retryAfter: 30 })
    const response = await POST({ params: { ludo: 'demo' }, request: makeRequest() } as never)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('30')
    expect(submit).not.toHaveBeenCalled()
  })

  it('partage le quota source entre variantes de slug', async () => {
    await POST({ params: { ludo: 'demo' }, request: makeRequest() } as never)
    await POST({ params: { ludo: 'slug-invente' }, request: makeRequest() } as never)
    expect(rate).toHaveBeenCalledTimes(2)
    expect(rate.mock.calls[0][0]).toBe(rate.mock.calls[1][0])
    expect(rate.mock.calls[0][0]).not.toContain('demo')
    expect(rate.mock.calls[1][0]).not.toContain('slug-invente')
  })

  it('arrête et annule un corps chunked dès que la limite réelle est dépassée', async () => {
    const cancelled = vi.fn(() => {
      throw new Error('échec simulé de l’annulation du producteur')
    })
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls += 1
          controller.enqueue(new Uint8Array(9_000))
        },
        cancel: cancelled,
      },
      { highWaterMark: 0 },
    )
    const request = new Request('https://api.test/api/public/contact/v1/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'request-00000001' },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    const response = await POST({ params: { ludo: 'demo' }, request } as never)
    expect(response.status).toBe(413)
    expect(cancelled).toHaveBeenCalledWith('Payload too large')
    expect(pulls).toBe(2)
    expect(submit).not.toHaveBeenCalled()
  })
})
