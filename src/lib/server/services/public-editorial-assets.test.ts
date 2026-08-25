import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../db/public-editorial-assets.js', () => ({
  listPublicEditorialAssetRows: db.list,
  getPublicEditorialAssetRow: db.get,
  insertPublicEditorialAssetRow: db.insert,
  updatePublicEditorialAssetRow: db.update,
  deletePublicEditorialAssetRow: db.remove,
}))

import { createAuthorizedMediaScope, publicSiteMediaPath } from '../media/paths.js'
import {
  addPublicPdfAttachment,
  deletePublicEditorialAsset,
  PublicEditorialAssetServiceError,
  upsertPublicSupportImage,
} from './public-editorial-assets.js'

const LUDO_ID = '10000000-0000-4000-8000-000000000001'
const NEWS_ID = '20000000-0000-4000-8000-000000000002'
const ACTIVITY_ID = '30000000-0000-4000-8000-000000000003'
const MEMBER_ID = '40000000-0000-4000-8000-000000000004'
const BLOB_ID = '50000000-0000-4000-8000-000000000005'
const NOW = new Date('2026-08-25T10:00:00.000Z')
const newsScope = createAuthorizedMediaScope({
  ludoId: LUDO_ID,
  domain: 'news',
  entityId: NEWS_ID,
})

function blob(type: 'image/webp' | 'application/pdf') {
  return {
    url: `https://blob.test/media.${type === 'application/pdf' ? 'pdf' : 'webp'}`,
    downloadUrl: 'https://blob.test/download',
    pathname: publicSiteMediaPath({ scope: newsScope, mediaType: type, blobId: BLOB_ID }),
    contentType: type,
    size: 2048,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.list.mockResolvedValue([])
  db.insert.mockImplementation(async (values) => values)
  db.update.mockImplementation(async (_id, _ludoId, values) => ({ id: 'asset', ...values }))
  db.remove.mockImplementation(async (id) => ({ id }))
})

describe('médias complémentaires publics', () => {
  it("enregistre une image d'appoint avec ses métadonnées", async () => {
    const result = await upsertPublicSupportImage({
      ludoId: LUDO_ID,
      owner: { type: 'news', id: NEWS_ID },
      memberId: MEMBER_ID,
      scope: newsScope,
      blob: blob('image/webp'),
      alt: 'Familles autour d’une table',
      caption: 'Après-midi jeux',
      credit: 'Association',
      now: NOW,
    })

    expect(result.previousStorageKey).toBeNull()
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        newsId: NEWS_ID,
        activityId: null,
        kind: 'support_image',
        alt: 'Familles autour d’une table',
        caption: 'Après-midi jeux',
        credit: 'Association',
      }),
    )
  })

  it("remplace l'image existante et retourne l'ancienne clé à nettoyer", async () => {
    db.list.mockResolvedValue([{ id: 'asset-image', kind: 'support_image', storageKey: 'old-key' }])

    const result = await upsertPublicSupportImage({
      ludoId: LUDO_ID,
      owner: { type: 'news', id: NEWS_ID },
      memberId: MEMBER_ID,
      scope: newsScope,
      blob: blob('image/webp'),
      alt: 'Nouvelle image',
      now: NOW,
    })

    expect(result.previousStorageKey).toBe('old-key')
    expect(db.update).toHaveBeenCalledWith(
      'asset-image',
      LUDO_ID,
      expect.objectContaining({ alt: 'Nouvelle image' }),
    )
  })

  it('conserve deux URL distinctes pour ouvrir et télécharger un PDF', async () => {
    await addPublicPdfAttachment({
      ludoId: LUDO_ID,
      owner: { type: 'news', id: NEWS_ID },
      memberId: MEMBER_ID,
      scope: newsScope,
      blob: blob('application/pdf'),
      title: 'Programme complet',
      fileName: 'programme.pdf',
      now: NOW,
    })

    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://blob.test/media.pdf',
        downloadUrl: 'https://blob.test/download',
        caption: 'Programme complet',
        fileName: 'programme.pdf',
      }),
    )
  })

  it('refuse un sixième PDF', async () => {
    db.list.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({ id: `pdf-${index}`, kind: 'pdf_attachment' })),
    )

    await expect(
      addPublicPdfAttachment({
        ludoId: LUDO_ID,
        owner: { type: 'news', id: NEWS_ID },
        memberId: MEMBER_ID,
        scope: newsScope,
        blob: blob('application/pdf'),
        title: 'Un PDF de trop',
        fileName: 'trop.pdf',
      }),
    ).rejects.toThrow('Maximum 5 PDF')
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("refuse un chemin média qui n'appartient pas au contenu", async () => {
    const activityScope = createAuthorizedMediaScope({
      ludoId: LUDO_ID,
      domain: 'activities',
      entityId: ACTIVITY_ID,
    })

    await expect(
      upsertPublicSupportImage({
        ludoId: LUDO_ID,
        owner: { type: 'news', id: NEWS_ID },
        memberId: MEMBER_ID,
        scope: activityScope,
        blob: {
          ...blob('image/webp'),
          pathname: publicSiteMediaPath({
            scope: activityScope,
            mediaType: 'image/webp',
            blobId: BLOB_ID,
          }),
        },
        alt: 'Image',
      }),
    ).rejects.toBeInstanceOf(PublicEditorialAssetServiceError)
  })

  it("ne supprime pas l'asset d'un autre propriétaire", async () => {
    db.get.mockResolvedValue({ id: 'asset', newsId: null, activityId: ACTIVITY_ID })

    await expect(
      deletePublicEditorialAsset('asset', LUDO_ID, { type: 'news', id: NEWS_ID }),
    ).rejects.toThrow('introuvable')
    expect(db.remove).not.toHaveBeenCalled()
  })
})
