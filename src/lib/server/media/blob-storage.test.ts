import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }))
vi.mock('$env/dynamic/private', () => ({ env: { BLOB_READ_WRITE_TOKEN: 'test-token' } }))

import { del, put } from '@vercel/blob'
import {
  deletePublicSiteMedia,
  MediaStorageError,
  uploadPublicSiteMedia,
  validateMediaFile,
} from './blob-storage.js'
import { createAuthorizedMediaScope } from './paths.js'

const LUDO = '11111111-1111-4111-8111-111111111111'
const ENTITY = '22222222-2222-4222-8222-222222222222'
const OTHER_LUDO = '44444444-4444-4444-8444-444444444444'
const OTHER_ENTITY = '55555555-5555-4555-8555-555555555555'
const scope = createAuthorizedMediaScope({ ludoId: LUDO, domain: 'gallery', entityId: ENTITY })
const otherScope = createAuthorizedMediaScope({
  ludoId: OTHER_LUDO,
  domain: 'gallery',
  entityId: OTHER_ENTITY,
})
const imagePolicy = {
  maxBytes: 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
}

function file(bytes: number[], type: string): File {
  return new File([new Uint8Array(bytes)], 'media', { type })
}

beforeEach(() => vi.clearAllMocks())

describe('validateMediaFile', () => {
  it.each([
    ['image/jpeg', [0xff, 0xd8, 0xff, 0x00]],
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]],
  ] as const)('accepte la signature %s', async (type, bytes) => {
    await expect(
      validateMediaFile(file([...bytes], type), { maxBytes: 1024, allowedTypes: [type] }),
    ).resolves.toBe(type)
  })

  it('refuse un fichier vide, trop lourd ou d’un MIME interdit', async () => {
    await expect(validateMediaFile(file([], 'image/jpeg'), imagePolicy)).rejects.toThrow(/vide/)
    await expect(
      validateMediaFile(file([0xff, 0xd8, 0xff, 0], 'image/jpeg'), { ...imagePolicy, maxBytes: 3 }),
    ).rejects.toThrow(/lourd/)
    await expect(
      validateMediaFile(file([0x25, 0x50, 0x44, 0x46, 0x2d], 'application/pdf'), imagePolicy),
    ).rejects.toThrow(/non autorisé/)
  })

  it('refuse un MIME déclaré qui ne correspond pas aux octets', async () => {
    await expect(
      validateMediaFile(file([0x89, 0x50, 0x4e, 0x47], 'image/jpeg'), imagePolicy),
    ).rejects.toThrow(/ne correspond pas/)
  })
})

describe('stockage Blob', () => {
  it('upload publiquement sous un chemin dérivé côté serveur', async () => {
    vi.mocked(put).mockImplementation(async (pathname) => ({
      url: `https://blob.test/${pathname}`,
      downloadUrl: `https://blob.test/${pathname}?download=1`,
      pathname: String(pathname),
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
      etag: 'test-etag',
    }))
    const stored = await uploadPublicSiteMedia({
      scope,
      file: file([0xff, 0xd8, 0xff, 0], 'image/jpeg'),
      policy: imagePolicy,
    })
    expect(stored.pathname).toMatch(new RegExp(`^public-site/${LUDO}/gallery/${ENTITY}/.*\\.jpg$`))
    expect(put).toHaveBeenCalledWith(
      stored.pathname,
      expect.any(File),
      expect.objectContaining({ access: 'public', contentType: 'image/jpeg', token: 'test-token' }),
    )
  })

  it('utilise downloadUrl comme URL publique canonique pour un PDF', async () => {
    vi.mocked(put).mockImplementation(async (pathname) => ({
      url: `https://blob.test/${pathname}`,
      downloadUrl: `https://blob.test/${pathname}?download=1`,
      pathname: String(pathname),
      contentType: 'application/pdf',
      contentDisposition: 'attachment',
      etag: 'test-etag',
    }))
    const stored = await uploadPublicSiteMedia({
      scope,
      file: file([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], 'application/pdf'),
      policy: { maxBytes: 1024, allowedTypes: ['application/pdf'] },
    })

    expect(stored.url).toBe(stored.downloadUrl)
    expect(stored.downloadUrl).toBe(`https://blob.test/${stored.pathname}?download=1`)
  })

  it('supprime uniquement un pathname public-site géré', async () => {
    const pathname = `public-site/${LUDO}/gallery/${ENTITY}/33333333-3333-4333-8333-333333333333.jpg`
    await deletePublicSiteMedia(scope, pathname)
    expect(del).toHaveBeenCalledWith(pathname, { token: 'test-token' })
    await expect(deletePublicSiteMedia(scope, 'themes/foreign.jpg')).rejects.toThrow(
      MediaStorageError,
    )
  })

  it('interdit au scope A de supprimer un média du scope B', async () => {
    const pathname = `public-site/${OTHER_LUDO}/gallery/${OTHER_ENTITY}/33333333-3333-4333-8333-333333333333.jpg`

    await expect(deletePublicSiteMedia(scope, pathname)).rejects.toThrow(/périmètre autorisé/)
    expect(del).not.toHaveBeenCalled()

    await deletePublicSiteMedia(otherScope, pathname)
    expect(del).toHaveBeenCalledWith(pathname, { token: 'test-token' })
  })
})
