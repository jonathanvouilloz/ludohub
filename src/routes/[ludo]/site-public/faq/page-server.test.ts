import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/db/sites.js', () => ({ listSiteRowsWithOpeningHours: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/services/public-faqs.js', () => {
  class PublicFaqServiceError extends Error {}
  return {
    PublicFaqServiceError,
    listPublicFaqsForManagement: vi.fn(),
    createPublicFaq: vi.fn(),
    updatePublicFaq: vi.fn(),
    publishPublicFaq: vi.fn(),
    hidePublicFaq: vi.fn(),
    deleteDraftPublicFaq: vi.fn(),
  }
})
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  createPublicFaq,
  deleteDraftPublicFaq,
  hidePublicFaq,
  listPublicFaqsForManagement,
  publishPublicFaq,
  updatePublicFaq,
} from '$lib/server/services/public-faqs.js'
import { actions, load } from './+page.server.js'
const L = '11111111-1111-4111-8111-111111111111',
  M = '22222222-2222-4222-8222-222222222222',
  ID = '33333333-3333-4333-8333-333333333333',
  S = '44444444-4444-4444-8444-444444444444'
const faq = {
  id: ID,
  ludoId: L,
  question: 'Comment adhérer ?',
  answerMarkdown: 'Réponse **Markdown**.',
  category: 'Adhésion',
  sortOrder: 2,
  status: 'draft',
  revision: 1,
  publishedAt: null,
  targets: [],
}
function event(fields: Array<[string, string]> = []) {
  const data = new FormData()
  for (const [k, v] of fields) data.append(k, v)
  return {
    params: { ludo: 'test' },
    locals: {},
    cookies: {},
    request: new Request('http://local.test', { method: 'POST', body: data }),
  }
}
function fields(extra: Array<[string, string]> = []): Array<[string, string]> {
  return [
    ['question', faq.question],
    ['answerMarkdown', faq.answerMarkdown],
    ['category', faq.category],
    ['sortOrder', '2'],
    ...extra,
  ]
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L }, member: { id: M } } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicFaqsForManagement).mockResolvedValue([faq] as never)
  vi.mocked(listSiteRowsWithOpeningHours).mockResolvedValue([{ id: S, isActive: true }] as never)
  vi.mocked(createPublicFaq).mockResolvedValue(faq as never)
  vi.mocked(updatePublicFaq).mockResolvedValue(faq as never)
  vi.mocked(publishPublicFaq).mockResolvedValue({
    faq: { ...faq, status: 'published' },
    changed: true,
    previousStatus: 'draft',
  } as never)
  vi.mocked(hidePublicFaq).mockResolvedValue({
    faq: { ...faq, status: 'hidden' },
    changed: true,
    previousStatus: 'published',
  } as never)
})
describe('route FAQ', () => {
  it('charge uniquement le tenant après session et module', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({ faqs: [faq] })
    expect(listPublicFaqsForManagement).toHaveBeenCalledWith(L)
    expect(listSiteRowsWithOpeningHours).toHaveBeenCalledWith(L)
  })
  it('bloque sans module et sans session', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(load(event() as never)).rejects.toMatchObject({ status: 404 })
    expect(listPublicFaqsForManagement).not.toHaveBeenCalled()
    vi.mocked(requireLudoContext).mockRejectedValue({ status: 401 })
    await expect(load(event() as never)).rejects.toMatchObject({ status: 401 })
  })
  it('crée avec auteur, ordre et ciblage', async () => {
    await actions.create!(
      event(
        fields([
          ['targetMode', 'explicit'],
          ['siteIds', S],
        ]),
      ) as never,
    )
    expect(createPublicFaq).toHaveBeenCalledWith(L, M, {
      question: faq.question,
      answerMarkdown: faq.answerMarkdown,
      category: faq.category,
      sortOrder: 2,
      targetMode: 'explicit',
      siteIds: [S],
    })
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_faq.created',
        actorLudoId: L,
        actorMemberId: M,
        metadata: { targetMode: 'explicit', targetSiteIds: [S], sortOrder: 2, hasCategory: true },
      }),
    )
    expect(vi.mocked(emitAuditEvent).mock.calls[0][0].metadata).not.toHaveProperty('answerMarkdown')
  })
  it('rejette un ciblage explicite vide', async () => {
    const result = await actions.create!(event(fields([['targetMode', 'explicit']])) as never)
    expect(result).toMatchObject({ status: 400 })
    expect(createPublicFaq).not.toHaveBeenCalled()
  })
  it('met à jour avec CAS', async () => {
    await actions.update!(
      event(
        fields([
          ['id', ID],
          ['revision', '5'],
          ['targetMode', 'all'],
        ]),
      ) as never,
    )
    expect(updatePublicFaq).toHaveBeenCalledWith(
      ID,
      L,
      expect.objectContaining({ targetMode: 'all', siteIds: [] }),
      M,
      5,
    )
  })
  it('audite seulement une publication effective', async () => {
    vi.mocked(publishPublicFaq).mockResolvedValue({
      faq: { ...faq, status: 'published' },
      changed: false,
      previousStatus: 'published',
    } as never)
    await actions.publication!(
      event([
        ['id', ID],
        ['revision', '2'],
        ['status', 'published'],
      ]) as never,
    )
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })
  it('masque tenant-scopé', async () => {
    await actions.publication!(
      event([
        ['id', ID],
        ['revision', '3'],
        ['status', 'hidden'],
      ]) as never,
    )
    expect(hidePublicFaq).toHaveBeenCalledWith(ID, L, M, 3)
  })
  it('supprime par le service brouillon et audite', async () => {
    await actions.delete!(
      event([
        ['id', ID],
        ['revision', '4'],
      ]) as never,
    )
    expect(deleteDraftPublicFaq).toHaveBeenCalledWith(ID, L, 4)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_faq.deleted' }),
    )
  })
})
