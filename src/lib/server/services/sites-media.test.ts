import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  reference: vi.fn(),
  photo: vi.fn(),
  update: vi.fn(),
}))
vi.mock('../db/sites.js', () => ({
  getSiteRowForLudo: mocks.get,
  getSitePhotoReferenceRow: mocks.reference,
  updateSitePhotoRow: mocks.photo,
  updateSiteWithIntervalsAtomic: mocks.update,
  deleteSiteRow: vi.fn(),
  insertSiteWithIntervalsAtomic: vi.fn(),
  listActiveSiteRows: vi.fn(),
  listSiteRowsWithOpeningHours: vi.fn(),
  updateSiteOrderRows: vi.fn(),
}))
import {
  authorizeSiteMediaScope,
  clearSitePhoto,
  setSitePhoto,
  updateSiteOpeningHours,
  isSitePhotoUnreferenced,
} from './sites.js'
import { createAuthorizedMediaScope, publicSiteMediaPath } from '../media/paths.js'
import type { StoredBlob } from '../media/blob-storage.js'

const LUDO = '10000000-0000-4000-8000-000000000001'
const SITE = '20000000-0000-4000-8000-000000000001'
const OTHER = '30000000-0000-4000-8000-000000000001'
const scope = createAuthorizedMediaScope({ ludoId: LUDO, domain: 'sites', entityId: SITE })
const path = publicSiteMediaPath({ scope, mediaType: 'image/webp' })
const blob: StoredBlob = {
  url: 'https://blob.test/photo.webp',
  downloadUrl: 'https://blob.test/photo.webp',
  pathname: path,
  contentType: 'image/webp',
  size: 1000,
}
const current = {
  id: SITE,
  ludoId: LUDO,
  name: 'Pâquis',
  slug: 'paquis',
  isPrimary: true,
  isActive: true,
  photoUrl: blob.url,
  photoStorageKey: path,
  photoAlt: 'Lieu',
  openingIntervals: [],
  sortOrder: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue(current)
  mocks.photo.mockResolvedValue(current)
  mocks.update.mockResolvedValue(undefined)
  mocks.reference.mockResolvedValue({ photoStorageKey: path })
})

describe('photos des lieux', () => {
  it.each([null, 'stale/photo.webp'])(
    'refuse ajout/remplacement/retrait périmé attendu %s',
    async (expected) => {
      await expect(setSitePhoto(LUDO, SITE, scope, blob, 'Lieu', expected)).rejects.toThrow(
        'simultanément',
      )
      await expect(clearSitePhoto(LUDO, SITE, expected)).rejects.toThrow('simultanément')
      expect(mocks.photo).not.toHaveBeenCalled()
    },
  )
  it('préserve le Blob si le commit est persistant malgré une réponse perdue', async () => {
    await expect(isSitePhotoUnreferenced(scope, path)).resolves.toBe(false)
    expect(mocks.reference).toHaveBeenCalledWith(SITE, LUDO)
  })
  it('préserve le Blob si la référence persistée ne peut pas être lue', async () => {
    mocks.reference.mockRejectedValue(new Error('Read unavailable'))
    await expect(isSitePhotoUnreferenced(scope, path)).resolves.toBe(false)
  })
  it('préserve le Blob si la lecture retourne une référence ambiguë', async () => {
    mocks.reference.mockResolvedValue({})
    await expect(isSitePhotoUnreferenced(scope, path)).resolves.toBe(false)
    mocks.reference.mockResolvedValue(null)
    await expect(isSitePhotoUnreferenced(scope, path)).resolves.toBe(false)
  })
  it('autorise la compensation uniquement lorsque la référence persistée est différente ou le lieu absent', async () => {
    mocks.reference
      .mockResolvedValueOnce({ photoStorageKey: 'another.webp' })
      .mockResolvedValueOnce(undefined)
    await expect(isSitePhotoUnreferenced(scope, path)).resolves.toBe(true)
    await expect(isSitePhotoUnreferenced(scope, path)).resolves.toBe(true)
  })
  it('ne supprime jamais un chemin hors du périmètre sites autorisé', async () => {
    const foreign = createAuthorizedMediaScope({ ludoId: OTHER, domain: 'sites', entityId: SITE })
    await expect(isSitePhotoUnreferenced(foreign, path)).resolves.toBe(false)
    expect(mocks.reference).not.toHaveBeenCalled()
  })
  it('retourne le résultat du CAS sans lecture après écriture susceptible de déclencher une compensation erronée', async () => {
    mocks.get
      .mockResolvedValueOnce(current)
      .mockRejectedValue(new Error('Database read unavailable'))
    const stored = { ...current, photoAlt: 'Nouvelle photo' }
    mocks.photo.mockResolvedValue(stored)
    const result = await setSitePhoto(LUDO, SITE, scope, blob, 'Nouvelle photo', path)
    expect(result.site).toBe(stored)
    expect(mocks.get).toHaveBeenCalledTimes(1)
  })

  it('retourne le retrait confirmé sans lecture supplémentaire avant nettoyage', async () => {
    mocks.get
      .mockResolvedValueOnce(current)
      .mockRejectedValue(new Error('Database read unavailable'))
    const cleared = { ...current, photoUrl: null, photoStorageKey: null, photoAlt: null }
    mocks.photo.mockResolvedValue(cleared)
    const result = await clearSitePhoto(LUDO, SITE, path)
    expect(result.site).toBe(cleared)
    expect(result.previousStorageKey).toBe(path)
    expect(mocks.get).toHaveBeenCalledTimes(1)
  })
  it('autorise après lecture du lieu sous le tenant', async () => {
    expect(await authorizeSiteMediaScope(LUDO, SITE)).toMatchObject({
      ludoId: LUDO,
      entityId: SITE,
      domain: 'sites',
    })
    expect(mocks.get).toHaveBeenCalledWith(SITE, LUDO)
    mocks.get.mockResolvedValue(undefined)
    await expect(authorizeSiteMediaScope(OTHER, SITE)).rejects.toThrow('Lieu introuvable')
  })

  it('enregistre une description de secours et retourne la clé précédente pour nettoyage', async () => {
    const result = await setSitePhoto(LUDO, SITE, scope, blob, '', path)
    expect(mocks.photo).toHaveBeenCalledWith(SITE, LUDO, path, {
      photoUrl: blob.url,
      photoStorageKey: path,
      photoAlt: 'Pâquis',
    })
    expect(result.previousStorageKey).toBe(path)
  })

  it('refuse une clé Blob du mauvais lieu ou tenant avant écriture', async () => {
    const foreign = createAuthorizedMediaScope({ ludoId: OTHER, domain: 'sites', entityId: SITE })
    await expect(
      setSitePhoto(
        LUDO,
        SITE,
        scope,
        { ...blob, pathname: publicSiteMediaPath({ scope: foreign, mediaType: 'image/webp' }) },
        'Lieu',
        path,
      ),
    ).rejects.toThrow("n'appartient pas")
    await expect(setSitePhoto(LUDO, OTHER, scope, blob, 'Lieu', path)).rejects.toThrow(
      "n'appartient pas",
    )
    expect(mocks.photo).not.toHaveBeenCalled()
  })

  it('refuse un PDF et une image trop volumineuse', async () => {
    await expect(
      setSitePhoto(LUDO, SITE, scope, { ...blob, contentType: 'application/pdf' }, 'Lieu', path),
    ).rejects.toThrow('photo')
    await expect(
      setSitePhoto(LUDO, SITE, scope, { ...blob, size: 6 * 1024 * 1024 }, 'Lieu', path),
    ).rejects.toThrow('photo')
    expect(mocks.photo).not.toHaveBeenCalled()
  })

  it('signale le conflit de remplacement/retrait sans annoncer un succès', async () => {
    mocks.photo.mockResolvedValue(undefined)
    await expect(setSitePhoto(LUDO, SITE, scope, blob, 'Lieu', path)).rejects.toThrow(
      'simultanément',
    )
    await expect(clearSitePhoto(LUDO, SITE, path)).rejects.toThrow('simultanément')
  })

  it('retire la référence avant de retourner la clé à nettoyer', async () => {
    expect((await clearSitePhoto(LUDO, SITE, path)).previousStorageKey).toBe(path)
    expect(mocks.photo).toHaveBeenCalledWith(SITE, LUDO, path, {
      photoUrl: null,
      photoStorageKey: null,
      photoAlt: null,
    })
  })

  it('les mises à jour horaires ne réécrivent aucune référence photo', async () => {
    await updateSiteOpeningHours(LUDO, SITE, [
      { dayOfWeek: 2, opensAt: '14:00', closesAt: '18:00' },
    ])
    const fields = mocks.update.mock.calls[0][2]
    expect(fields).not.toHaveProperty('photoUrl')
    expect(fields).not.toHaveProperty('photoStorageKey')
    expect(fields).not.toHaveProperty('photoAlt')
    expect(mocks.photo).not.toHaveBeenCalled()
  })
})
