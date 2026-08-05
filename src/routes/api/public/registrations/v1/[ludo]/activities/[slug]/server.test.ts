import { beforeEach, describe, expect, it, vi } from 'vitest'

const { submit, cors, rate } = vi.hoisted(() => ({ submit: vi.fn(), cors: vi.fn(), rate: vi.fn() }))
vi.mock('$lib/server/services/public-activity-registrations.js', () => {
  class PublicActivityRegistrationServiceError extends Error {
    constructor(
      message: string,
      public readonly code: 'invalid' | 'not_found' | 'conflict' = 'invalid',
    ) {
      super(message)
    }
  }
  return {
    PublicActivityRegistrationServiceError,
    submitPublicActivityRegistrationByLudoSlug: submit,
  }
})
vi.mock('$lib/server/public-http.js', () => ({ publicCorsHeaders: cors }))
vi.mock('$lib/server/services/rate-limit.js', () => ({ checkRateLimit: rate }))
import { POST } from './+server.js'
import { PublicActivityRegistrationServiceError } from '$lib/server/services/public-activity-registrations.js'

const body = {
  contactName: 'Ada',
  email: 'ada@example.ch',
  participantCount: 2,
  message: 'Deux enfants',
}
function request(payload: unknown = body, source = '203.0.113.1') {
  return new Request('https://api.test/api/public/registrations/v1/demo/activities/atelier', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'request-00000001',
      'x-forwarded-for': source,
    },
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  cors.mockReturnValue(new Headers())
  rate.mockReturnValue({ ok: true })
  submit.mockResolvedValue({
    receiptId: 'receipt-a',
    status: 'waitlisted',
    message: 'Nous vous contacterons si une place se libère.',
    created: true,
  })
})

describe('POST inscription activité', () => {
  it('retourne seulement le reçu, le statut et le message générique', async () => {
    const response = await POST({
      params: { ludo: 'demo', slug: 'atelier' },
      request: request(),
    } as never)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      accepted: true,
      receiptId: 'receipt-a',
      status: 'waitlisted',
      message: 'Nous vous contacterons si une place se libère.',
    })
    expect(submit).toHaveBeenCalledWith('demo', 'atelier', 'request-00000001', {
      ...body,
      phone: undefined,
    })
  })

  it('absorbe le honeypot sans stockage', async () => {
    const response = await POST({
      params: { ludo: 'demo', slug: 'atelier' },
      request: request({ ...body, website: 'robot' }),
    } as never)
    expect(response.status).toBe(202)
    expect(submit).not.toHaveBeenCalled()
  })

  it("renvoie 409 si la clé d'idempotence correspond à une autre demande", async () => {
    submit.mockRejectedValueOnce(
      new PublicActivityRegistrationServiceError('Autre demande.', 'conflict'),
    )
    const response = await POST({
      params: { ludo: 'demo', slug: 'atelier' },
      request: request(),
    } as never)
    expect(response.status).toBe(409)
  })

  it('partage le quota entre tenants et activités', async () => {
    await POST({ params: { ludo: 'demo', slug: 'atelier' }, request: request() } as never)
    await POST({ params: { ludo: 'autre', slug: 'autre-atelier' }, request: request() } as never)
    expect(rate.mock.calls[0][0]).toBe(rate.mock.calls[1][0])
    expect(rate.mock.calls[0][0]).not.toMatch(/demo|atelier/)
  })

  it('refuse et annule un corps chunked au-delà de 16 Kio', async () => {
    const cancelled = vi.fn()
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
    const streamed = new Request('https://api.test/registration', {
      method: 'POST',
      headers: { 'idempotency-key': 'request-00000001' },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    const response = await POST({
      params: { ludo: 'demo', slug: 'atelier' },
      request: streamed,
    } as never)
    expect(response.status).toBe(413)
    expect(cancelled).toHaveBeenCalledWith('Payload too large')
    expect(pulls).toBe(2)
    expect(submit).not.toHaveBeenCalled()
  })
})
