import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  get: vi.fn(), insert: vi.fn(), update: vi.fn(), publication: vi.fn(), remove: vi.fn(), list: vi.fn(), visible: vi.fn(),
  sites: vi.fn(), enabled: vi.fn(), targets: vi.fn(), categories: vi.fn(), category: vi.fn(), ensureCategories: vi.fn(), insertCategory: vi.fn(), updateCategory: vi.fn(),
}))
vi.mock('../db/public-faqs.js', () => ({
  getPublicFaqRowForLudo: m.get, insertPublicFaqAtomic: m.insert, updatePublicFaqAtomic: m.update,
  updatePublicFaqPublicationRow: m.publication, deleteDraftPublicFaqRow: m.remove, deletePublicFaqRow: m.remove,
  listPublicFaqRows: m.list, listVisiblePublicFaqRows: m.visible, listPublicFaqCategoryRows: m.categories,
  getPublicFaqCategoryRowForLudo: m.category, ensureDefaultPublicFaqCategories: m.ensureCategories,
  insertPublicFaqCategoryRow: m.insertCategory, updatePublicFaqCategoryRow: m.updateCategory,
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: m.sites }))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled: m.enabled, validatePublicSiteTargets: m.targets }))
import { createPublicFaq, createPublicFaqCategory, listVisiblePublicFaqs, updatePublicFaq, updatePublicFaqCategory } from './public-faqs.js'

const L = '00000000-0000-4000-8000-000000000001', M = '00000000-0000-4000-8000-000000000002', C = '00000000-0000-4000-8000-000000000003'
const row = (changes: Record<string, unknown> = {}) => ({
  id: 'faq', ludoId: L, question: 'Question ?', answerText: 'Réponse', categoryId: C,
  category: { id: C, name: 'Autre', isActive: true }, status: 'draft', revision: 1, targets: [], ...changes,
})
beforeEach(() => {
  vi.clearAllMocks(); m.get.mockResolvedValue(row()); m.insert.mockResolvedValue(row()); m.update.mockResolvedValue(row({ revision: 2 }));
  m.enabled.mockResolvedValue(true); m.sites.mockResolvedValue([{ id: 'site', ludoId: L }]); m.targets.mockResolvedValue(undefined);
  m.category.mockResolvedValue({ id: C, ludoId: L, name: 'Autre', isActive: true }); m.categories.mockResolvedValue([]); m.ensureCategories.mockResolvedValue(undefined);
  m.insertCategory.mockResolvedValue([{ id: 'new', name: 'Nouvelle', sortOrder: 7 }]); m.updateCategory.mockResolvedValue([{ id: C, name: 'Autre' }]); m.visible.mockResolvedValue([])
})

describe('FAQ simplifiée', () => {
  it('crée une question avec une réponse texte et une catégorie active', async () => {
    await createPublicFaq(L, M, { question: ' Q ? ', answerText: ' Réponse ', categoryId: C, targetMode: 'explicit', siteIds: ['site'] })
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ question: 'Q ?', answerText: 'Réponse', categoryId: C }), ['site'])
  })
  it('préserve le texte et la catégorie lors d’une modification partielle', async () => {
    await updatePublicFaq('faq', L, { question: 'Nouvelle question' }, M, 1)
    expect(m.update).toHaveBeenCalledWith('faq', L, 1, expect.objectContaining({ question: 'Nouvelle question', answerText: 'Réponse', categoryId: C }), [])
  })
  it('permet de créer, renommer, activer et ordonner les catégories', async () => {
    await createPublicFaqCategory(L, ' Nouvelle ')
    await updatePublicFaqCategory(C, L, { name: 'Infos', isActive: false, sortOrder: 2 })
    expect(m.insertCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nouvelle', sortOrder: 0 }))
    expect(m.updateCategory).toHaveBeenCalledWith(C, L, expect.objectContaining({ name: 'Infos', isActive: false, sortOrder: 2 }))
  })
  it('borne la liste publique', async () => {
    await listVisiblePublicFaqs(L, undefined, 999)
    expect(m.visible).toHaveBeenCalledWith(L, undefined, 200)
  })
})
