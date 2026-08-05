import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/services/public-contacts.js', () => {
  class PublicContactServiceError extends Error {
    code = 'invalid'
  }
  return {
    PublicContactServiceError,
    listPublicContactsForManagement: vi.fn(),
    transitionPublicContact: vi.fn(),
  }
})
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  listPublicContactsForManagement,
  transitionPublicContact,
} from '$lib/server/services/public-contacts.js'
import { actions, load } from './+page.server.js'
const L = '11111111-1111-4111-8111-111111111111',
  M = '22222222-2222-4222-8222-222222222222',
  ID = '33333333-3333-4333-8333-333333333333',
  message = {
    id: ID,
    ludoId: L,
    recipient: 'paquis',
    name: 'Alice',
    email: 'alice@example.ch',
    phone: '022',
    subject: 'Question',
    message: 'Privé',
    status: 'new',
    revision: 1,
    createdAt: new Date(),
  }
function event(fields: Array<[string, string]> = []) {
  const d = new FormData()
  for (const [k, v] of fields) d.append(k, v)
  return {
    params: { ludo: 'x' },
    locals: {},
    cookies: {},
    request: new Request('http://x', { method: 'POST', body: d }),
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L }, member: { id: M } } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicContactsForManagement).mockResolvedValue([message] as never)
  vi.mocked(transitionPublicContact).mockResolvedValue({
    message: { ...message, status: 'processed' },
    changed: true,
  } as never)
})
describe('route contacts privée', () => {
  it('charge uniquement la boîte du tenant', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({ messages: [message] })
    expect(listPublicContactsForManagement).toHaveBeenCalledWith(L, undefined)
  })
  it('exige session et module', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(load(event() as never)).rejects.toMatchObject({ status: 404 })
  })
  it('marque traité avec acteur et CAS sans PII dans audit', async () => {
    await actions.transition!(
      event([
        ['id', ID],
        ['revision', '1'],
        ['status', 'processed'],
      ]) as never,
    )
    expect(transitionPublicContact).toHaveBeenCalledWith(ID, L, 'processed', M, 1)
    const audit = vi.mocked(emitAuditEvent).mock.calls[0][0]
    expect(audit.metadata).toEqual({ toStatus: 'processed' })
    expect(JSON.stringify(audit)).not.toContain('alice@example.ch')
    expect(JSON.stringify(audit)).not.toContain('Privé')
  })
  it('archive et audite', async () => {
    vi.mocked(transitionPublicContact).mockResolvedValue({
      message: { ...message, status: 'archived' },
      changed: true,
    } as never)
    await actions.transition!(
      event([
        ['id', ID],
        ['revision', '2'],
        ['status', 'archived'],
      ]) as never,
    )
    expect(transitionPublicContact).toHaveBeenCalledWith(ID, L, 'archived', M, 2)
  })
  it('n’audite pas transition idempotente', async () => {
    vi.mocked(transitionPublicContact).mockResolvedValue({
      message: { ...message, status: 'processed' },
      changed: false,
    } as never)
    await actions.transition!(
      event([
        ['id', ID],
        ['revision', '2'],
        ['status', 'processed'],
      ]) as never,
    )
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })
})
