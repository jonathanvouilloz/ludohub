import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => ({ isPublicSiteEnabled: vi.fn(), PublicSiteServiceError: class extends Error {} }))
vi.mock('$lib/server/services/public-faqs.js', () => ({
  PublicFaqServiceError: class extends Error {}, listPublicFaqsForManagement: vi.fn(), listPublicFaqCategoriesForManagement: vi.fn(),
  createPublicFaq: vi.fn(), updatePublicFaq: vi.fn(), publishPublicFaq: vi.fn(), hidePublicFaq: vi.fn(), permanentlyDeletePublicFaq: vi.fn(),
  createPublicFaqCategory: vi.fn(), updatePublicFaqCategory: vi.fn(),
}))
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import { createPublicFaq, createPublicFaqCategory, listPublicFaqCategoriesForManagement, listPublicFaqsForManagement, updatePublicFaqCategory } from '$lib/server/services/public-faqs.js'
import { actions, load } from './+page.server.js'

const L = '11111111-1111-4111-8111-111111111111', M = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333'
const faq = { id: 'faq', revision: 1, question: 'Comment adhérer ?', answerText: 'Sur place.', categoryId: C, category: { name: 'Adhésion' }, status: 'draft', targets: [] }
function event(fields: Array<[string, string]> = []) { const data = new FormData(); fields.forEach(([key, value]) => data.append(key, value)); return { params: { ludo: 'demo' }, request: new Request('http://x', { method: 'POST', body: data }) } }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L }, member: { id: M } } as never); vi.mocked(isPublicSiteEnabled).mockResolvedValue(true); vi.mocked(listPublicFaqsForManagement).mockResolvedValue([faq] as never); vi.mocked(listPublicFaqCategoriesForManagement).mockResolvedValue([{ id: C, name: 'Adhésion', sortOrder: 0, isActive: true }] as never); vi.mocked(createPublicFaq).mockResolvedValue(faq as never); vi.mocked(createPublicFaqCategory).mockResolvedValue({ id: 'new' } as never); vi.mocked(updatePublicFaqCategory).mockResolvedValue({ id: C } as never) })

describe('route FAQ simplifiée', () => {
  it('charge questions et catégories du tenant', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({ faqs: [faq], categories: [{ id: C }] })
  })
  it('crée une réponse texte dans la catégorie choisie', async () => {
    await actions.create!(event([['question', faq.question], ['answerText', faq.answerText], ['categoryId', C]]) as never)
    expect(createPublicFaq).toHaveBeenCalledWith(L, M, { question: faq.question, answerText: faq.answerText, categoryId: C, targetMode: 'all', siteIds: [] })
  })
  it('crée et réordonne des catégories', async () => {
    await actions.createCategory!(event([['name', 'Infos pratiques']]) as never)
    await actions.updateCategory!(event([['id', C], ['name', 'Infos'], ['sortOrder', '2'], ['isActive', 'false']]) as never)
    expect(createPublicFaqCategory).toHaveBeenCalledWith(L, 'Infos pratiques')
    expect(updatePublicFaqCategory).toHaveBeenCalledWith(C, L, { name: 'Infos', sortOrder: 2, isActive: false })
  })
})
