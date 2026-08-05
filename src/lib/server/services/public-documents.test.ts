import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  get: vi.fn(),
  published: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  publication: vi.fn(),
  pdf: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  visible: vi.fn(),
  sites: vi.fn(),
  enabled: vi.fn(),
  targets: vi.fn(),
  resolveTargets: vi.fn(),
  ensureTargets: vi.fn(),
}))
vi.mock('../db/public-documents.js', () => ({
  getPublicDocumentRowForLudo: m.get,
  getPublishedPublicDocumentBySlug: m.published,
  insertPublicDocumentAtomic: m.insert,
  updatePublicDocumentAtomic: m.update,
  updatePublicDocumentPublicationRow: m.publication,
  updatePublicDocumentPdfRow: m.pdf,
  deleteDraftPublicDocumentRow: m.remove,
  listPublicDocumentRows: m.list,
  listVisiblePublicDocumentSummaryRows: m.visible,
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: m.sites }))
vi.mock('./public-site.js', () => ({
  isPublicSiteEnabled: m.enabled,
  validatePublicSiteTargets: m.targets,
}))
vi.mock('./public-faqs.js', () => {
  class PublicFaqServiceError extends Error {}
  return {
    PublicFaqServiceError,
    resolvePublicEditorialTargets: m.resolveTargets,
    ensurePublicEditorialTargets: m.ensureTargets,
    validatePublicEditorialText: (value: string, label: string, max: number) => {
      const normalized = value.trim()
      if (!normalized || normalized.length > max)
        throw new PublicFaqServiceError(`${label} invalide`)
      return normalized
    },
    validatePublicEditorialMarkdown: (value: string) => {
      const normalized = value.trim()
      if (/[<>]/.test(normalized)) throw new PublicFaqServiceError('HTML interdit')
      return normalized
    },
  }
})
import { createAuthorizedMediaScope, publicSiteMediaPath } from '../media/paths.js'
import {
  authorizePublicDocumentMediaScope,
  clearPublicDocumentPdf,
  createPublicDocument,
  deleteDraftPublicDocument,
  getVisiblePublicDocumentBySlug,
  listVisiblePublicDocuments,
  publishPublicDocument,
  PublicDocumentServiceError,
  setPublicDocumentPdf,
  updatePublicDocument,
} from './public-documents.js'
import { PublicFaqServiceError } from './public-faqs.js'
const L = '00000000-0000-4000-8000-000000000001',
  D = '00000000-0000-4000-8000-000000000002',
  M = '00000000-0000-4000-8000-000000000003',
  NOW = new Date('2026-08-05T12:00:00Z')
const row = (x: Record<string, unknown> = {}) => ({
  id: D,
  ludoId: L,
  slug: 'mission',
  kind: 'mission',
  title: 'Mission',
  summary: null,
  bodyMarkdown: null,
  year: null,
  pdfUrl: null,
  pdfStorageKey: null,
  pdfFileName: null,
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
  m.pdf.mockResolvedValue(row({ revision: 2 }))
  m.remove.mockResolvedValue({ id: D, pdfStorageKey: null })
  m.enabled.mockResolvedValue(true)
  m.targets.mockResolvedValue(undefined)
  m.sites.mockResolvedValue([{ id: 'site', ludoId: L }])
  m.visible.mockResolvedValue([])
  m.resolveTargets.mockImplementation(async (_ludoId, mode, siteIds, preserved) =>
    mode === undefined ? (preserved ?? []) : siteIds,
  )
  m.ensureTargets.mockResolvedValue(undefined)
})
describe('documents institutionnels', () => {
  it('autorise un brouillon vide pour amorcer un PDF-only', async () => {
    await createPublicDocument(
      L,
      M,
      { slug: 'Mission', kind: 'mission', title: 'Mission', targetMode: 'all', siteIds: [] },
      NOW,
    )
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ bodyMarkdown: null, pdfStorageKey: null, status: 'draft' }),
      [],
    )
  })
  it('valide année exclusivement pour annual_report', async () => {
    await expect(
      createPublicDocument(L, M, {
        slug: 'r',
        kind: 'annual_report',
        title: 'R',
        targetMode: 'all',
        siteIds: [],
      }),
    ).rejects.toThrow(/année/)
    await expect(
      createPublicDocument(L, M, {
        slug: 'm',
        kind: 'mission',
        title: 'M',
        year: 2025,
        targetMode: 'all',
        siteIds: [],
      }),
    ).rejects.toThrow(/réservée/)
    await createPublicDocument(L, M, {
      slug: 'r',
      kind: 'annual_report',
      title: 'R',
      year: 2025,
      bodyMarkdown: 'Texte',
      targetMode: 'all',
      siteIds: [],
    })
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ year: 2025 }), [])
  })
  it('fige le slug après première publication et sécurise le Markdown', async () => {
    m.get.mockResolvedValue(row({ publishedAt: NOW, status: 'hidden', bodyMarkdown: 'Texte' }))
    await expect(updatePublicDocument(D, L, { slug: 'autre' }, M, 1)).rejects.toThrow(/slug/)
    await expect(
      updatePublicDocument(D, L, { bodyMarkdown: '<script>x</script>' }, M, 1),
    ).rejects.toBeInstanceOf(PublicDocumentServiceError)
  })
  it('traduit validation et ciblage FAQ en erreurs Documents', async () => {
    await expect(
      createPublicDocument(L, M, {
        slug: 'x',
        kind: 'mission',
        title: '   ',
        targetMode: 'all',
        siteIds: [],
      }),
    ).rejects.toBeInstanceOf(PublicDocumentServiceError)
    m.resolveTargets.mockRejectedValueOnce(new PublicFaqServiceError('cible inactive'))
    await expect(
      createPublicDocument(L, M, {
        slug: 'x',
        kind: 'mission',
        title: 'Titre',
        targetMode: 'explicit',
        siteIds: ['x'],
      }),
    ).rejects.toBeInstanceOf(PublicDocumentServiceError)
  })
  it('traduit le ciblage de publication en erreur Documents', async () => {
    m.get.mockResolvedValue(row({ bodyMarkdown: 'Texte' }))
    m.ensureTargets.mockRejectedValueOnce(new PublicFaqServiceError('module inactif'))
    await expect(publishPublicDocument(D, L, M, 1)).rejects.toBeInstanceOf(
      PublicDocumentServiceError,
    )
  })
  it('refuse de publier sans corps ni PDF et vérifie le CAS', async () => {
    await expect(publishPublicDocument(D, L, M, 1)).rejects.toThrow(/Markdown ou un PDF/)
    m.get.mockResolvedValue(row({ bodyMarkdown: 'Texte', revision: 2 }))
    await expect(publishPublicDocument(D, L, M, 1)).rejects.toThrow(/Rechargez/)
  })
  it('autorise scope documents puis PDF <=15MiB avec chemin propriétaire', async () => {
    const scope = await authorizePublicDocumentMediaScope(L, D, 1)
    expect(scope).toEqual(expect.objectContaining({ domain: 'documents', ludoId: L, entityId: D }))
    const pathname = publicSiteMediaPath({
      scope,
      mediaType: 'application/pdf',
      blobId: '00000000-0000-4000-8000-000000000004',
    })
    m.get
      .mockResolvedValueOnce(row({ pdfStorageKey: 'old.pdf' }))
      .mockResolvedValueOnce(row({ revision: 2 }))
    await expect(
      setPublicDocumentPdf(
        L,
        D,
        M,
        1,
        scope,
        {
          url: 'https://cdn.test/a.pdf',
          downloadUrl: 'https://cdn.test/a.pdf',
          pathname,
          contentType: 'application/pdf',
          size: 15 * 1024 * 1024,
        },
        'statuts.pdf',
        NOW,
      ),
    ).resolves.toEqual({ document: expect.anything(), previousStorageKey: 'old.pdf' })
    expect(m.pdf).toHaveBeenCalledWith(
      D,
      L,
      1,
      expect.objectContaining({ pdfStorageKey: pathname, pdfFileName: 'statuts.pdf' }),
    )
  })
  it('rejette type, taille, scope et chemin forgés', async () => {
    const scope = createAuthorizedMediaScope({ ludoId: L, domain: 'documents', entityId: D })
    const path = publicSiteMediaPath({ scope, mediaType: 'application/pdf' })
    await expect(
      setPublicDocumentPdf(
        L,
        D,
        M,
        1,
        scope,
        { url: 'x', downloadUrl: 'x', pathname: path, contentType: 'image/png', size: 10 } as never,
        'x.pdf',
      ),
    ).rejects.toThrow(/PDF/)
    await expect(
      setPublicDocumentPdf(
        L,
        D,
        M,
        1,
        scope,
        {
          url: 'x',
          downloadUrl: 'x',
          pathname: path,
          contentType: 'application/pdf',
          size: 15 * 1024 * 1024 + 1,
        },
        'x.pdf',
      ),
    ).rejects.toThrow(/15 MiB/)
    const other = createAuthorizedMediaScope({
      ludoId: L,
      domain: 'documents',
      entityId: '00000000-0000-4000-8000-000000000009',
    })
    await expect(
      setPublicDocumentPdf(
        L,
        D,
        M,
        1,
        other,
        { url: 'x', downloadUrl: 'x', pathname: path, contentType: 'application/pdf', size: 10 },
        'x.pdf',
      ),
    ).rejects.toThrow(/appartient/)
  })
  it('efface avec cleanup key mais conserve un contenu hors brouillon', async () => {
    m.get.mockResolvedValueOnce(
      row({ status: 'published', pdfStorageKey: 'old', bodyMarkdown: null }),
    )
    await expect(clearPublicDocumentPdf(L, D, M, 1)).rejects.toThrow(/conserver/)
    m.get
      .mockResolvedValueOnce(row({ pdfStorageKey: 'old' }))
      .mockResolvedValueOnce(row({ revision: 2 }))
    await expect(clearPublicDocumentPdf(L, D, M, 1)).resolves.toEqual({
      document: expect.anything(),
      previousStorageKey: 'old',
    })
  })
  it('retourne la clé PDF lors de la suppression du brouillon', async () => {
    m.remove.mockResolvedValue({ id: D, pdfStorageKey: 'old' })
    await expect(deleteDraftPublicDocument(D, L, 1)).resolves.toEqual({ previousStorageKey: 'old' })
  })
  it('borne/projette la liste et filtre le détail public', async () => {
    await listVisiblePublicDocuments(L, undefined, 500)
    expect(m.visible).toHaveBeenCalledWith(L, undefined, 50)
    m.published.mockResolvedValue({ id: D, ludoId: L, slug: 'mission', targets: [] })
    await expect(getVisiblePublicDocumentBySlug(L, 'Mission')).resolves.toEqual(
      expect.objectContaining({ id: D }),
    )
    m.enabled.mockResolvedValue(false)
    await expect(listVisiblePublicDocuments(L)).resolves.toEqual([])
  })
})
