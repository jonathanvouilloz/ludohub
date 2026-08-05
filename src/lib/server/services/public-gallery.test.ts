import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  get: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  pub: vi.fn(),
  file: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  visible: vi.fn(),
  sites: vi.fn(),
  enabled: vi.fn(),
  resolve: vi.fn(),
  ensure: vi.fn(),
}))
vi.mock('../db/public-gallery.js', () => ({
  getPublicGalleryRowForLudo: m.get,
  insertPublicGalleryAtomic: m.insert,
  updatePublicGalleryAtomic: m.update,
  updatePublicGalleryPublicationRow: m.pub,
  updatePublicGalleryFileRow: m.file,
  deleteDraftPublicGalleryRow: m.remove,
  listPublicGalleryRows: m.list,
  listVisiblePublicGalleryRows: m.visible,
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: m.sites }))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled: m.enabled }))
vi.mock('./public-faqs.js', () => {
  class PublicFaqServiceError extends Error {}
  return {
    PublicFaqServiceError,
    resolvePublicEditorialTargets: m.resolve,
    ensurePublicEditorialTargets: m.ensure,
    validatePublicEditorialText: (v: string) => {
      if (!v.trim()) throw new PublicFaqServiceError('vide')
      return v.trim()
    },
    validatePublicSortOrder: (v: number) => {
      if (!Number.isSafeInteger(v) || v < 0) throw new PublicFaqServiceError('ordre')
      return v
    },
  }
})
import { createAuthorizedMediaScope, publicSiteMediaPath } from '../media/paths.js'
import {
  clearPublicGalleryImageFile,
  createPublicGalleryImage,
  deleteDraftPublicGalleryImage,
  listVisiblePublicGallery,
  publishPublicGalleryImage,
  PublicGalleryServiceError,
  setPublicGalleryImageFile,
  updatePublicGalleryImage,
} from './public-gallery.js'
const L = '00000000-0000-4000-8000-000000000001',
  I = '00000000-0000-4000-8000-000000000002',
  M = '00000000-0000-4000-8000-000000000003',
  N = new Date()
const row = (x: Record<string, unknown> = {}) => ({
  id: I,
  ludoId: L,
  caption: null,
  alt: null,
  sortOrder: 0,
  imageUrl: null,
  imageStorageKey: null,
  status: 'draft',
  revision: 1,
  publishedAt: null,
  publishedByMemberId: null,
  targets: [],
  ...x,
})
beforeEach(() => {
  vi.clearAllMocks()
  m.get.mockResolvedValue(row())
  m.insert.mockResolvedValue(row())
  m.update.mockResolvedValue(row({ revision: 2 }))
  m.pub.mockResolvedValue(row({ revision: 2 }))
  m.file.mockResolvedValue(row({ revision: 2 }))
  m.remove.mockResolvedValue({ id: I, imageStorageKey: null })
  m.visible.mockResolvedValue([])
  m.enabled.mockResolvedValue(true)
  m.sites.mockResolvedValue([{ id: 's', ludoId: L }])
  m.resolve.mockImplementation(async (_l, mode, s, p) => (mode === undefined ? (p ?? []) : s))
  m.ensure.mockResolvedValue(undefined)
})
describe('galerie', () => {
  it('crée un brouillon sans image', async () => {
    await createPublicGalleryImage(L, M, { sortOrder: 1, targetMode: 'all', siteIds: [] }, N)
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ imageStorageKey: null, status: 'draft' }),
      [],
    )
  })
  it('refuse publication sans image/alt puis traduit ciblage', async () => {
    await expect(publishPublicGalleryImage(I, L, M, 1)).rejects.toThrow(/image et un texte/)
    m.get.mockResolvedValue(row({ imageStorageKey: 'x', alt: 'Alt' }))
    m.ensure.mockRejectedValue(
      new (await import('./public-faqs.js')).PublicFaqServiceError('inactif'),
    )
    await expect(publishPublicGalleryImage(I, L, M, 1)).rejects.toBeInstanceOf(
      PublicGalleryServiceError,
    )
  })
  it('fait CAS sur update', async () => {
    m.update.mockResolvedValue(undefined)
    await expect(updatePublicGalleryImage(I, L, { caption: 'X' }, M, 1)).rejects.toThrow(
      /Rechargez/,
    )
  })
  it('applique scope, formats et limite 8MiB', async () => {
    const s = createAuthorizedMediaScope({ ludoId: L, domain: 'gallery', entityId: I }),
      path = publicSiteMediaPath({ scope: s, mediaType: 'image/webp' })
    m.get
      .mockResolvedValueOnce(row({ imageStorageKey: 'old' }))
      .mockResolvedValueOnce(row({ revision: 2 }))
    await expect(
      setPublicGalleryImageFile(
        L,
        I,
        M,
        1,
        s,
        {
          url: 'https://x',
          downloadUrl: 'https://x',
          pathname: path,
          contentType: 'image/webp',
          size: 8 * 1024 * 1024,
        },
        'Alt',
      ),
    ).resolves.toEqual({ image: expect.anything(), previousStorageKey: 'old' })
    await expect(
      setPublicGalleryImageFile(
        L,
        I,
        M,
        1,
        s,
        { url: 'x', downloadUrl: 'x', pathname: path, contentType: 'application/pdf', size: 1 },
        'Alt',
      ),
    ).rejects.toThrow(/Format/)
    await expect(
      setPublicGalleryImageFile(
        L,
        I,
        M,
        1,
        s,
        {
          url: 'x',
          downloadUrl: 'x',
          pathname: path,
          contentType: 'image/png',
          size: 8 * 1024 * 1024 + 1,
        },
        'Alt',
      ),
    ).rejects.toThrow(/8 MiB/)
  })
  it('clear/delete retournent cleanup key', async () => {
    m.get
      .mockResolvedValueOnce(row({ imageStorageKey: 'old' }))
      .mockResolvedValueOnce(row({ revision: 2 }))
    await expect(clearPublicGalleryImageFile(L, I, M, 1)).resolves.toEqual({
      image: expect.anything(),
      previousStorageKey: 'old',
    })
    m.get.mockResolvedValue(row({ imageStorageKey: 'old' }))
    m.remove.mockResolvedValue({ id: I, imageStorageKey: 'old' })
    await expect(deleteDraftPublicGalleryImage(I, L, 1)).resolves.toEqual({
      previousStorageKey: 'old',
    })
  })
  it('borne public', async () => {
    await listVisiblePublicGallery(L, undefined, 500)
    expect(m.visible).toHaveBeenCalledWith(L, undefined, 100)
  })
})
