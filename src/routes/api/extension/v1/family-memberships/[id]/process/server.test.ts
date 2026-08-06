import { beforeEach, describe, expect, it, vi } from 'vitest'

const principal = vi.hoisted(() => vi.fn())
const readJson = vi.hoisted(() => vi.fn())
const processSubmission = vi.hoisted(() => vi.fn())
const dto = vi.hoisted(() => vi.fn((value) => ({ id: value.id, status: value.status })))
vi.mock('$lib/server/extension-http.js', () => {
  return {
    extensionHeaders: () => new Headers({ 'Cache-Control': 'no-store' }),
    readExtensionJson: readJson,
    requireExtensionPrincipal: principal,
    extensionError: (error: unknown) => {
      throw error
    },
  }
})
vi.mock('$lib/server/services/family-registrations.js', () => ({
  FamilyRegistrationServiceError: class FamilyRegistrationServiceError extends Error {
    constructor(
      message: string,
      public readonly code: 'invalid' | 'not_found' | 'conflict' = 'invalid',
    ) {
      super(message)
    }
  },
  processFamilySubmission: processSubmission,
}))
vi.mock('$lib/server/extension-family-dto.js', () => ({ extensionFamilySubmissionDto: dto }))

import { FamilyRegistrationServiceError } from '$lib/server/services/family-registrations.js'
import { PATCH } from './+server.js'

beforeEach(() => {
  vi.clearAllMocks()
  principal.mockResolvedValue({ ludoId: 'tenant-from-token', memberId: 'member-from-token' })
  readJson.mockResolvedValue({ expectedRevision: 7, revision: 999 })
  processSubmission.mockResolvedValue({
    id: 'submission',
    status: 'processed',
    purgeAt: new Date(),
  })
})

describe('PATCH process contract', () => {
  it('utilise tenant/membre du Bearer et expectedRevision, puis la whitelist', async () => {
    const request = new Request(
      'https://api.test/api/extension/v1/family-memberships/submission/process',
      { method: 'PATCH', body: '{}' },
    )
    const response = await PATCH({ request, params: { id: 'submission' } } as never)
    expect(processSubmission).toHaveBeenCalledWith(
      'submission',
      'tenant-from-token',
      'member-from-token',
      7,
    )
    expect(await response.json()).toEqual({ submission: { id: 'submission', status: 'processed' } })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it.each([
    ['conflict', 409],
    ['not_found', 404],
  ])('mappe %s sans donnée métier', async (code, status) => {
    processSubmission.mockRejectedValue(
      new FamilyRegistrationServiceError('interne', code as 'conflict' | 'not_found'),
    )
    const response = await PATCH({
      request: new Request('https://api.test/x', { method: 'PATCH', body: '{}' }),
      params: { id: 'submission' },
    } as never)
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error: code })
  })
})
