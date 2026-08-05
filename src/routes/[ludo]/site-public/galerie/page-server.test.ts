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
vi.mock('$lib/server/services/public-gallery.js', () => {
  class PublicGalleryServiceError extends Error {}
  return {
    PublicGalleryServiceError,
    listPublicGalleryForManagement: vi.fn(),
    createPublicGalleryImage: vi.fn(),
    updatePublicGalleryImage: vi.fn(),
    publishPublicGalleryImage: vi.fn(),
    hidePublicGalleryImage: vi.fn(),
    deleteDraftPublicGalleryImage: vi.fn(),
    authorizePublicGalleryMediaScope: vi.fn(),
    setPublicGalleryImageFile: vi.fn(),
    clearPublicGalleryImageFile: vi.fn(),
  }
})
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import { deletePublicSiteMedia, uploadPublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  authorizePublicGalleryMediaScope,
  createPublicGalleryImage,
  deleteDraftPublicGalleryImage,
  listPublicGalleryForManagement,
  setPublicGalleryImageFile,
} from '$lib/server/services/public-gallery.js'
import { actions, load } from './+page.server.js'
const L = '11111111-1111-4111-8111-111111111111',
  M = '22222222-2222-4222-8222-222222222222',
  ID = '33333333-3333-4333-8333-333333333333',
  OLD = `public-site/${L}/gallery/${ID}/old.jpg`,
  NEW = `public-site/${L}/gallery/${ID}/new.jpg`,
  scope = { ludoId: L, domain: 'gallery', entityId: ID } as never,
  item = {
    id: ID,
    revision: 1,
    caption: 'Jeux en fête',
    alt: 'Des joueurs',
    sortOrder: 1,
    status: 'draft',
    imageUrl: null,
    imageStorageKey: OLD,
    targets: [],
  }
function event(fields: Array<[string, FormDataEntryValue]> = []) {
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
  vi.mocked(listPublicGalleryForManagement).mockResolvedValue([item] as never)
  vi.mocked(createPublicGalleryImage).mockResolvedValue(item as never)
  vi.mocked(authorizePublicGalleryMediaScope).mockResolvedValue(scope)
  vi.mocked(uploadPublicSiteMedia).mockResolvedValue({
    pathname: NEW,
    url: 'https://x',
    downloadUrl: 'https://x',
    contentType: 'image/jpeg',
    size: 3,
  } as never)
  vi.mocked(setPublicGalleryImageFile).mockResolvedValue({
    image: item,
    previousStorageKey: OLD,
  } as never)
  vi.mocked(deleteDraftPublicGalleryImage).mockResolvedValue({ previousStorageKey: OLD } as never)
  vi.mocked(uploadAndRegisterMedia).mockImplementation(async (x) => {
    const s = await x.authorize(),
      b = await x.upload(s)
    try {
      return await x.register(s, b)
    } catch (e) {
      await x.cleanup(s, b.pathname)
      throw e
    }
  })
})
describe('route galerie', () => {
  it('charge tenant-scopé et garde le module', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({ galleryItems: [item] })
    expect(listPublicGalleryForManagement).toHaveBeenCalledWith(L)
  })
  it('crée sans album avec ciblage', async () => {
    await actions.create!(
      event([
        ['caption', 'Jeux en fête'],
        ['alt', 'Des joueurs'],
        ['sortOrder', '1'],
        ['targetMode', 'all'],
      ]) as never,
    )
    expect(createPublicGalleryImage).toHaveBeenCalledWith(L, M, {
      caption: 'Jeux en fête',
      alt: 'Des joueurs',
      sortOrder: 1,
      targetMode: 'all',
      siteIds: [],
    })
  })
  it('transmet l’alt courant au remplacement sécurisé 8 MiB', async () => {
    const f = new File(['jpg'], 'x.jpg', { type: 'image/jpeg' })
    await actions.uploadImage!(
      event([
        ['id', ID],
        ['revision', '1'],
        ['alt', 'Des joueurs'],
        ['file', f],
      ]) as never,
    )
    expect(setPublicGalleryImageFile).toHaveBeenCalledWith(
      L,
      ID,
      M,
      1,
      scope,
      expect.objectContaining({ pathname: NEW }),
      'Des joueurs',
    )
    expect(uploadPublicSiteMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: {
          maxBytes: 8 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
      }),
    )
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD)
  })
  it('rejette un alt manquant avant upload', async () => {
    const f = new File(['jpg'], 'x.jpg', { type: 'image/jpeg' })
    const result = await actions.uploadImage!(
      event([
        ['id', ID],
        ['revision', '1'],
        ['file', f],
      ]) as never,
    )
    expect(result).toMatchObject({ status: 400 })
    expect(uploadPublicSiteMedia).not.toHaveBeenCalled()
  })
  it('supprime brouillon puis nettoie', async () => {
    await actions.delete!(
      event([
        ['id', ID],
        ['revision', '1'],
      ]) as never,
    )
    expect(deleteDraftPublicGalleryImage).toHaveBeenCalledWith(ID, L, 1)
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD)
  })
})
