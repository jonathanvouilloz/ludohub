import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/db/sites.js', () => ({ listSiteRowsWithOpeningHours: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/media/blob-storage.js', () => {
  class MediaStorageError extends Error {}
  return { MediaStorageError, uploadPublicSiteMedia: vi.fn(), deletePublicSiteMedia: vi.fn() }
})
vi.mock('$lib/server/media/media-service.js', () => {
  class MediaCompensationError extends Error {}
  return { MediaCompensationError, uploadAndRegisterMedia: vi.fn() }
})
vi.mock('$lib/server/services/public-documents.js', () => {
  class PublicDocumentServiceError extends Error {}
  return {
    PublicDocumentServiceError,
    listPublicDocumentsForManagement: vi.fn(),
    createPublicDocument: vi.fn(),
    updatePublicDocument: vi.fn(),
    publishPublicDocument: vi.fn(),
    hidePublicDocument: vi.fn(),
    deleteDraftPublicDocument: vi.fn(),
    authorizePublicDocumentMediaScope: vi.fn(),
    setPublicDocumentPdf: vi.fn(),
    clearPublicDocumentPdf: vi.fn(),
  }
})
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import { deletePublicSiteMedia, uploadPublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import {
  authorizePublicDocumentMediaScope,
  clearPublicDocumentPdf,
  createPublicDocument,
  deleteDraftPublicDocument,
  listPublicDocumentsForManagement,
  publishPublicDocument,
  setPublicDocumentPdf,
  updatePublicDocument,
} from '$lib/server/services/public-documents.js'
import { actions, load } from './+page.server.js'
const L = '11111111-1111-4111-8111-111111111111',
  M = '22222222-2222-4222-8222-222222222222',
  ID = '33333333-3333-4333-8333-333333333333',
  S = '44444444-4444-4444-8444-444444444444',
  OLD = `public-site/${L}/documents/${ID}/old.pdf`,
  NEW = `public-site/${L}/documents/${ID}/new.pdf`
const scope = { ludoId: L, domain: 'documents', entityId: ID } as never
const doc = {
  id: ID,
  ludoId: L,
  slug: 'rapport-2025',
  kind: 'annual_report',
  title: 'Rapport 2025',
  summary: 'Résumé',
  bodyMarkdown: '## Bilan',
  year: 2025,
  status: 'draft',
  revision: 1,
  publishedAt: null,
  pdfUrl: null,
  pdfStorageKey: OLD,
  pdfFileName: null,
  targets: [],
}
function event(fields: Array<[string, FormDataEntryValue]> = []) {
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
    ['slug', doc.slug],
    ['kind', 'annual_report'],
    ['title', doc.title],
    ['summary', doc.summary],
    ['bodyMarkdown', doc.bodyMarkdown],
    ['year', '2025'],
    ...extra,
  ]
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L }, member: { id: M } } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicDocumentsForManagement).mockResolvedValue([doc] as never)
  vi.mocked(listSiteRowsWithOpeningHours).mockResolvedValue([{ id: S, isActive: true }] as never)
  vi.mocked(createPublicDocument).mockResolvedValue(doc as never)
  vi.mocked(updatePublicDocument).mockResolvedValue(doc as never)
  vi.mocked(publishPublicDocument).mockResolvedValue({
    document: { ...doc, status: 'published' },
    changed: true,
    previousStatus: 'draft',
  } as never)
  vi.mocked(deleteDraftPublicDocument).mockResolvedValue({ previousStorageKey: OLD } as never)
  vi.mocked(authorizePublicDocumentMediaScope).mockResolvedValue(scope)
  vi.mocked(uploadPublicSiteMedia).mockResolvedValue({
    pathname: NEW,
    url: 'https://blob/new.pdf',
    downloadUrl: 'https://blob/new.pdf?download=1',
    contentType: 'application/pdf',
    size: 4,
  } as never)
  vi.mocked(setPublicDocumentPdf).mockResolvedValue({
    document: doc,
    previousStorageKey: OLD,
  } as never)
  vi.mocked(clearPublicDocumentPdf).mockResolvedValue({
    document: doc,
    previousStorageKey: OLD,
  } as never)
  vi.mocked(uploadAndRegisterMedia).mockImplementation(async (input) => {
    const s = await input.authorize()
    const blob = await input.upload(s)
    try {
      return await input.register(s, blob)
    } catch (cause) {
      await input.cleanup(s, blob.pathname)
      throw cause
    }
  })
})
describe('route documents', () => {
  it('charge documents et lieux tenant-scopés', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({ documents: [doc] })
    expect(listPublicDocumentsForManagement).toHaveBeenCalledWith(L)
    expect(listSiteRowsWithOpeningHours).toHaveBeenCalledWith(L)
  })
  it('bloque si module désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(load(event() as never)).rejects.toMatchObject({ status: 404 })
    expect(listPublicDocumentsForManagement).not.toHaveBeenCalled()
  })
  it('crée un rapport annuel sans auditer son contenu', async () => {
    await actions.create!(
      event(
        fields([
          ['targetMode', 'explicit'],
          ['siteIds', S],
        ]),
      ) as never,
    )
    expect(createPublicDocument).toHaveBeenCalledWith(L, M, {
      slug: doc.slug,
      kind: 'annual_report',
      title: doc.title,
      summary: doc.summary,
      bodyMarkdown: doc.bodyMarkdown,
      year: 2025,
      targetMode: 'explicit',
      siteIds: [S],
    })
    const metadata = vi.mocked(emitAuditEvent).mock.calls[0][0].metadata
    expect(metadata).not.toHaveProperty('summary')
    expect(metadata).not.toHaveProperty('bodyMarkdown')
  })
  it('met à jour sans slug publié avec CAS', async () => {
    const values = fields([
      ['id', ID],
      ['revision', '6'],
      ['targetMode', 'all'],
    ]).filter(([k]) => k !== 'slug')
    await actions.update!(event(values) as never)
    expect(updatePublicDocument).toHaveBeenCalledWith(
      ID,
      L,
      expect.objectContaining({ slug: undefined, targetMode: 'all', siteIds: [] }),
      M,
      6,
    )
  })
  it('publie avec tenant acteur et CAS', async () => {
    await actions.publication!(
      event([
        ['id', ID],
        ['revision', '2'],
        ['status', 'published'],
      ]) as never,
    )
    expect(publishPublicDocument).toHaveBeenCalledWith(ID, L, M, 2)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_document.published' }),
    )
  })
  it('upload le PDF dans le scope exact puis nettoie ancien blob', async () => {
    const file = new File(['pdf'], 'rapport.pdf', { type: 'application/pdf' })
    await actions.uploadFile!(
      event([
        ['id', ID],
        ['revision', '1'],
        ['file', file],
      ]) as never,
    )
    expect(authorizePublicDocumentMediaScope).toHaveBeenCalledWith(L, ID, 1)
    expect(uploadPublicSiteMedia).toHaveBeenCalledWith({
      scope,
      file: expect.objectContaining({ name: 'rapport.pdf', type: 'application/pdf' }),
      policy: { maxBytes: 15 * 1024 * 1024, allowedTypes: ['application/pdf'] },
    })
    expect(setPublicDocumentPdf).toHaveBeenCalledWith(
      L,
      ID,
      M,
      1,
      scope,
      expect.objectContaining({ pathname: NEW }),
      'rapport.pdf',
    )
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD)
  })
  it('compense le nouveau blob si son enregistrement échoue', async () => {
    const file = new File(['pdf'], 'rapport.pdf', { type: 'application/pdf' })
    vi.mocked(setPublicDocumentPdf).mockRejectedValue(new Error('database unavailable'))
    await expect(
      actions.uploadFile!(
        event([
          ['id', ID],
          ['revision', '1'],
          ['file', file],
        ]) as never,
      ),
    ).rejects.toThrow('database unavailable')
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, NEW)
    expect(deletePublicSiteMedia).not.toHaveBeenCalledWith(scope, OLD)
  })
  it('supprime le PDF enregistré avec scope serveur', async () => {
    await actions.removeFile!(
      event([
        ['id', ID],
        ['revision', '3'],
      ]) as never,
    )
    expect(clearPublicDocumentPdf).toHaveBeenCalledWith(L, ID, M, 3)
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD)
  })
  it('supprime le brouillon puis nettoie son PDF', async () => {
    await actions.delete!(
      event([
        ['id', ID],
        ['revision', '4'],
      ]) as never,
    )
    expect(deleteDraftPublicDocument).toHaveBeenCalledWith(ID, L, 4)
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_document.deleted' }),
    )
  })
})
