import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  get: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  publication: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  visible: vi.fn(),
  sites: vi.fn(),
  enabled: vi.fn(),
  targets: vi.fn(),
}))
vi.mock('../db/public-faqs.js', () => ({
  getPublicFaqRowForLudo: m.get,
  insertPublicFaqAtomic: m.insert,
  updatePublicFaqAtomic: m.update,
  updatePublicFaqPublicationRow: m.publication,
  deleteDraftPublicFaqRow: m.remove,
  listPublicFaqRows: m.list,
  listVisiblePublicFaqRows: m.visible,
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: m.sites }))
vi.mock('./public-site.js', () => ({
  isPublicSiteEnabled: m.enabled,
  validatePublicSiteTargets: m.targets,
}))
import {
  createPublicFaq,
  deleteDraftPublicFaq,
  hidePublicFaq,
  listVisiblePublicFaqs,
  publishPublicFaq,
  updatePublicFaq,
  validatePublicEditorialMarkdown,
} from './public-faqs.js'
const L = '00000000-0000-4000-8000-000000000001',
  M = '00000000-0000-4000-8000-000000000002',
  NOW = new Date('2026-08-05T12:00:00Z')
const row = (x: Record<string, unknown> = {}) => ({
  id: 'faq',
  ludoId: L,
  question: 'Question ?',
  answerMarkdown: 'Réponse',
  category: null,
  sortOrder: 2,
  status: 'draft',
  revision: 1,
  authorMemberId: M,
  updatedByMemberId: M,
  publishedByMemberId: null,
  publishedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  targets: [],
  ...x,
})
beforeEach(() => {
  vi.clearAllMocks()
  m.get.mockResolvedValue(row())
  m.insert.mockResolvedValue(row())
  m.update.mockResolvedValue(row({ revision: 2 }))
  m.publication.mockResolvedValue(row({ revision: 2 }))
  m.remove.mockResolvedValue({ id: 'faq' })
  m.enabled.mockResolvedValue(true)
  m.sites.mockResolvedValue([{ id: 'site', ludoId: L }])
  m.targets.mockResolvedValue(undefined)
  m.visible.mockResolvedValue([])
})
describe('FAQ', () => {
  it('sécurise le Markdown', () => {
    expect(() => validatePublicEditorialMarkdown('<b>x</b>', 'Réponse', 100)).toThrow(/HTML/)
    expect(() => validatePublicEditorialMarkdown('[x](javascript:x)', 'Réponse', 100)).toThrow(
      /lien/,
    )
    expect(validatePublicEditorialMarkdown('**ok**', 'Réponse', 100)).toBe('**ok**')
  })
  it('crée avec ordre manuel et cibles actives', async () => {
    await createPublicFaq(
      L,
      M,
      {
        question: ' Q ? ',
        answerMarkdown: ' R ',
        category: ' Général ',
        sortOrder: 4,
        targetMode: 'explicit',
        siteIds: ['site'],
      },
      NOW,
    )
    expect(m.targets).toHaveBeenCalledWith(L, ['site'])
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Q ?',
        answerMarkdown: 'R',
        category: 'Général',
        sortOrder: 4,
        revision: 1,
      }),
      ['site'],
    )
  })
  it('refuse ordres et ciblages invalides', async () => {
    await expect(
      createPublicFaq(L, M, {
        question: 'Q',
        answerMarkdown: 'R',
        sortOrder: -1,
        targetMode: 'all',
        siteIds: [],
      }),
    ).rejects.toThrow(/ordre/)
    await expect(
      createPublicFaq(L, M, {
        question: 'Q',
        answerMarkdown: 'R',
        sortOrder: 1,
        targetMode: 'explicit',
        siteIds: [],
      }),
    ).rejects.toThrow(/lieu actif/)
  })
  it('fait le CAS et préserve les cibles si absentes', async () => {
    await updatePublicFaq('faq', L, { question: 'Nouvelle' }, M, 1, NOW)
    expect(m.update).toHaveBeenCalledWith(
      'faq',
      L,
      1,
      expect.objectContaining({ question: 'Nouvelle' }),
      [],
    )
    m.update.mockResolvedValue(undefined)
    await expect(updatePublicFaq('faq', L, { question: 'X' }, M, 1)).rejects.toThrow(/Rechargez/)
  })
  it('publie seulement avec module/lieu puis rend idempotent', async () => {
    m.enabled.mockResolvedValueOnce(false)
    await expect(publishPublicFaq('faq', L, M, 1)).rejects.toThrow(/module public/)
    const published = row({
      status: 'published',
      revision: 2,
      publishedAt: NOW,
      publishedByMemberId: M,
    })
    m.get.mockResolvedValue(published)
    await expect(publishPublicFaq('faq', L, M, 2)).resolves.toEqual({
      faq: published,
      changed: false,
      previousStatus: 'published',
    })
    await expect(hidePublicFaq('faq', L, M, 2)).resolves.toEqual(
      expect.objectContaining({ changed: true }),
    )
  })
  it('supprime seulement un brouillon avec CAS', async () => {
    await deleteDraftPublicFaq('faq', L, 1)
    expect(m.remove).toHaveBeenCalledWith('faq', L, 1)
    m.get.mockResolvedValue(row({ status: 'hidden' }))
    await expect(deleteDraftPublicFaq('faq', L, 1)).rejects.toThrow(/brouillon/)
  })
  it('borne et masque la liste publique', async () => {
    await listVisiblePublicFaqs(L, undefined, 999)
    expect(m.visible).toHaveBeenCalledWith(L, undefined, 200)
    m.enabled.mockResolvedValue(false)
    await expect(listVisiblePublicFaqs(L)).resolves.toEqual([])
  })
})
