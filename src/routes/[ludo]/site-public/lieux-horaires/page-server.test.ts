import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({
  requireLudoContext: vi.fn(),
  requireResponsableContext: vi.fn(),
}))
vi.mock('$lib/server/services/sites.js', () => {
  class SiteServiceError extends Error {}
  return {
    SiteServiceError,
    createSiteWithOpeningHours: vi.fn(),
    deleteSite: vi.fn(),
    listSitesWithOpeningHours: vi.fn(),
    reorderSites: vi.fn(),
    updateSiteWithOpeningHours: vi.fn(),
    authorizeSiteMediaScope: vi.fn(),
    getSiteByIdForLudo: vi.fn(),
    setSitePhoto: vi.fn(),
    clearSitePhoto: vi.fn(),
    isSitePhotoUnreferenced: vi.fn(),
  }
})
vi.mock('$lib/server/media/blob-storage.js', () => ({
  MediaStorageError: class extends Error {},
  deletePublicSiteMedia: vi.fn(),
  uploadPublicSiteMedia: vi.fn(),
}))

import { requireLudoContext, requireResponsableContext } from '$lib/server/ludo-context.js'
import {
  createSiteWithOpeningHours,
  deleteSite,
  listSitesWithOpeningHours,
  reorderSites,
  updateSiteWithOpeningHours,
  authorizeSiteMediaScope,
  getSiteByIdForLudo,
  setSitePhoto,
  clearSitePhoto,
  isSitePhotoUnreferenced,
  SiteServiceError,
} from '$lib/server/services/sites.js'
import { deletePublicSiteMedia, uploadPublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { createAuthorizedMediaScope, publicSiteMediaPath } from '$lib/server/media/paths.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const SITE_ID = '22222222-2222-4222-8222-222222222222'
const scope = createAuthorizedMediaScope({ ludoId: LUDO_ID, entityId: SITE_ID, domain: 'sites' })
const pathname = publicSiteMediaPath({ scope, mediaType: 'image/webp' })
const context = {
  ludo: { id: LUDO_ID },
  member: { id: 'member-a', ludoId: LUDO_ID, role: 'responsable', isActive: true },
}

function event(fields: Array<[string, string | File]> = []) {
  const formData = new FormData()
  for (const [name, value] of fields) formData.append(name, value)
  return {
    params: { ludo: 'test' },
    locals: {},
    cookies: {},
    request: new Request('http://local.test', { method: 'POST', body: formData }),
  }
}

const siteFields: Array<[string, string]> = [
  ['siteId', SITE_ID],
  ['slug', 'paquis'],
  ['name', 'Pâquis'],
  ['address', ' Rue du jeu 1 '],
  ['postalCode', '1201'],
  ['city', 'Genève'],
  ['phone', ''],
  ['email', 'contact@example.test'],
  ['accessInfo', 'Rez-de-chaussée'],
  ['latitude', '46.21'],
  ['longitude', '6.14'],
  ['isActive', 'on'],
  ['openingHours', JSON.stringify([{ dayOfWeek: 2, opensAt: '14:00', closesAt: '18:00' }])],
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue(context as never)
  vi.mocked(requireResponsableContext).mockResolvedValue(context as never)
  vi.mocked(listSitesWithOpeningHours).mockResolvedValue([])
  vi.mocked(createSiteWithOpeningHours).mockResolvedValue({ id: SITE_ID } as never)
  vi.mocked(updateSiteWithOpeningHours).mockResolvedValue({ id: SITE_ID } as never)
  vi.mocked(reorderSites).mockResolvedValue(undefined)
  vi.mocked(deleteSite).mockResolvedValue({ id: SITE_ID, photoStorageKey: 'old/photo.webp' })
  vi.mocked(authorizeSiteMediaScope).mockResolvedValue(scope)
  vi.mocked(getSiteByIdForLudo).mockResolvedValue({
    id: SITE_ID,
    photoStorageKey: 'old/photo.webp',
  } as never)
  vi.mocked(uploadPublicSiteMedia).mockResolvedValue({
    pathname,
    url: 'https://blob.test/new.webp',
    downloadUrl: 'https://blob.test/new.webp',
    contentType: 'image/webp',
    size: 10,
  })
  vi.mocked(setSitePhoto).mockResolvedValue({
    site: { id: SITE_ID } as never,
    previousStorageKey: 'old/photo.webp',
  })
  vi.mocked(clearSitePhoto).mockResolvedValue({
    site: { id: SITE_ID } as never,
    previousStorageKey: 'old/photo.webp',
  })
  vi.mocked(deletePublicSiteMedia).mockResolvedValue(undefined)
  vi.mocked(isSitePhotoUnreferenced).mockResolvedValue(true)
})

describe('route Site public — lieux et horaires', () => {
  it('refuse les anciens formulaires sans référence attendue pour ajout et retrait', async () => {
    const upload = event([
      ['siteId', SITE_ID],
      ['photoFile', new File(['image'], 'lieu.webp', { type: 'image/webp' })],
    ])
    await expect(actions.uploadPhoto!(upload as never)).resolves.toMatchObject({ status: 400 })
    await expect(
      actions.removePhoto!(event([['siteId', SITE_ID]]) as never),
    ).resolves.toMatchObject({ status: 400 })
    expect(uploadPublicSiteMedia).not.toHaveBeenCalled()
    expect(clearSitePhoto).not.toHaveBeenCalled()
    expect(deletePublicSiteMedia).not.toHaveBeenCalled()
  })
  it.each(['', 'stale/photo.webp'])(
    'refuse un ajout/remplacement depuis une référence affichée périmée %s avant upload',
    async (expected) => {
      const request = event([
        ['siteId', SITE_ID],
        ['expectedPhotoStorageKey', expected],
        ['photoFile', new File(['image'], 'lieu.webp', { type: 'image/webp' })],
      ])
      await expect(actions.uploadPhoto!(request as never)).resolves.toMatchObject({ status: 400 })
      expect(uploadPublicSiteMedia).not.toHaveBeenCalled()
      expect(setSitePhoto).not.toHaveBeenCalled()
      expect(deletePublicSiteMedia).not.toHaveBeenCalled()
    },
  )
  it('transmet null pour un ajout à un lieu sans photo', async () => {
    vi.mocked(getSiteByIdForLudo).mockResolvedValue({ id: SITE_ID, photoStorageKey: null } as never)
    vi.mocked(setSitePhoto).mockResolvedValue({
      site: { id: SITE_ID } as never,
      previousStorageKey: null,
    })
    const request = event([
      ['siteId', SITE_ID],
      ['expectedPhotoStorageKey', ''],
      ['photoFile', new File(['image'], 'lieu.webp', { type: 'image/webp' })],
    ])
    await expect(actions.uploadPhoto!(request as never)).resolves.toEqual({ success: true })
    expect(setSitePhoto).toHaveBeenCalledWith(LUDO_ID, SITE_ID, scope, expect.anything(), '', null)
    expect(deletePublicSiteMedia).not.toHaveBeenCalled()
  })
  it('transmet la référence affichée au retrait et conserve la photo concurrente quand le CAS refuse', async () => {
    vi.mocked(clearSitePhoto).mockRejectedValue(
      new SiteServiceError('Photo modifiée simultanément'),
    )
    await expect(
      actions.removePhoto!(
        event([
          ['siteId', SITE_ID],
          ['expectedPhotoStorageKey', 'stale/photo.webp'],
        ]) as never,
      ),
    ).resolves.toMatchObject({ status: 400 })
    expect(clearSitePhoto).toHaveBeenCalledWith(LUDO_ID, SITE_ID, 'stale/photo.webp')
    expect(getSiteByIdForLudo).not.toHaveBeenCalled()
    expect(deletePublicSiteMedia).not.toHaveBeenCalled()
  })
  it.each([false, true])(
    'préserve un commit incertain même si la lecture voit encore une ancienne référence (non référencé : %s)',
    async (unreferenced) => {
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const failure = new Error('Commit response lost')
      vi.mocked(setSitePhoto).mockRejectedValue(failure)
      vi.mocked(isSitePhotoUnreferenced).mockResolvedValue(unreferenced)
      const request = event([
        ['siteId', SITE_ID],
        ['expectedPhotoStorageKey', 'old/photo.webp'],
        ['photoFile', new File(['image'], 'lieu.webp', { type: 'image/webp' })],
      ])
      await expect(actions.uploadPhoto!(request as never)).resolves.toMatchObject({
        status: 500,
        data: {
          error:
            'L’enregistrement de la photo n’a pas pu être confirmé. Rechargez le lieu pour vérifier la photo avant de réessayer.',
        },
      })
      expect(isSitePhotoUnreferenced).toHaveBeenCalledWith(scope, pathname)
      expect(deletePublicSiteMedia).not.toHaveBeenCalled()
      expect(warning).toHaveBeenCalled()
      warning.mockRestore()
    },
  )
  it('remplace une photo et nettoie son prédécesseur après enregistrement', async () => {
    const request = event([
      ['siteId', SITE_ID],
      ['photoFile', new File(['image'], 'lieu.webp', { type: 'image/webp' })],
      ['photoAlt', 'Le lieu'],
      ['expectedPhotoStorageKey', 'old/photo.webp'],
    ])
    await expect(actions.uploadPhoto!(request as never)).resolves.toEqual({ success: true })
    expect(setSitePhoto).toHaveBeenCalledWith(
      LUDO_ID,
      SITE_ID,
      scope,
      expect.anything(),
      'Le lieu',
      'old/photo.webp',
    )
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, 'old/photo.webp')
    expect(vi.mocked(setSitePhoto).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deletePublicSiteMedia).mock.invocationCallOrder[0],
    )
    expect(requireResponsableContext).toHaveBeenCalled()
  })

  it('compense un enregistrement refusé et conserve le prédécesseur', async () => {
    vi.mocked(setSitePhoto).mockRejectedValueOnce(new SiteServiceError('Conflit'))
    const request = event([
      ['siteId', SITE_ID],
      ['photoFile', new File(['image'], 'lieu.webp', { type: 'image/webp' })],
      ['expectedPhotoStorageKey', 'old/photo.webp'],
    ])
    await expect(actions.uploadPhoto!(request as never)).resolves.toMatchObject({ status: 400 })
    expect(deletePublicSiteMedia).toHaveBeenCalledExactlyOnceWith(scope, pathname)
  })

  it('préserve aussi le Blob après refus certain si sa référence est présente, ambiguë ou illisible', async () => {
    vi.mocked(setSitePhoto).mockRejectedValueOnce(new SiteServiceError('Conflit'))
    vi.mocked(isSitePhotoUnreferenced).mockResolvedValue(false)
    const request = event([
      ['siteId', SITE_ID],
      ['expectedPhotoStorageKey', 'old/photo.webp'],
      ['photoFile', new File(['image'], 'lieu.webp', { type: 'image/webp' })],
    ])
    await expect(actions.uploadPhoto!(request as never)).resolves.toMatchObject({ status: 400 })
    expect(isSitePhotoUnreferenced).toHaveBeenCalledWith(scope, pathname)
    expect(deletePublicSiteMedia).not.toHaveBeenCalled()
  })

  it('retire la photo avant de nettoyer le Blob', async () => {
    await expect(
      actions.removePhoto!(
        event([
          ['siteId', SITE_ID],
          ['expectedPhotoStorageKey', 'old/photo.webp'],
        ]) as never,
      ),
    ).resolves.toEqual({
      success: true,
    })
    expect(clearSitePhoto).toHaveBeenCalledWith(LUDO_ID, SITE_ID, 'old/photo.webp')
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, 'old/photo.webp')
  })
  it('affiche un retour inline pour un retrait incertain sans nettoyer le Blob', async () => {
    vi.mocked(clearSitePhoto).mockRejectedValue(new Error('Commit response lost'))
    const request = event([
      ['siteId', SITE_ID],
      ['expectedPhotoStorageKey', 'old/photo.webp'],
    ])
    await expect(actions.removePhoto!(request as never)).resolves.toMatchObject({
      status: 500,
      data: {
        error:
          'Le retrait de la photo n’a pas pu être confirmé. Rechargez le lieu pour vérifier le retrait avant de réessayer.',
      },
    })
    expect(deletePublicSiteMedia).not.toHaveBeenCalled()
  })
  it('charge les lieux du tenant et expose le droit de modification', async () => {
    await expect(load(event() as never)).resolves.toEqual({ sites: [], canEdit: true })
    expect(listSitesWithOpeningHours).toHaveBeenCalledWith(LUDO_ID)
  })

  it('crée un lieu avec coordonnées et horaires validés', async () => {
    await expect(actions.create!(event(siteFields) as never)).resolves.toEqual({ success: true })
    expect(createSiteWithOpeningHours).toHaveBeenCalledWith(
      LUDO_ID,
      expect.objectContaining({
        slug: 'paquis',
        name: 'Pâquis',
        address: 'Rue du jeu 1',
        latitude: 46.21,
        longitude: 6.14,
        isActive: true,
        openingIntervals: [{ dayOfWeek: 2, opensAt: '14:00', closesAt: '18:00' }],
      }),
    )
  })

  it('modifie le bon lieu et remplace ses horaires', async () => {
    await actions.update!(event(siteFields) as never)
    expect(updateSiteWithOpeningHours).toHaveBeenCalledWith(
      LUDO_ID,
      SITE_ID,
      expect.objectContaining({
        name: 'Pâquis',
        openingIntervals: [{ dayOfWeek: 2, opensAt: '14:00', closesAt: '18:00' }],
      }),
    )
  })

  it('réordonne et supprime dans le tenant responsable', async () => {
    await actions.reorder!(event([['orderedIds', JSON.stringify([SITE_ID, 'site-b'])]]) as never)
    await actions.delete!(event([['siteId', SITE_ID]]) as never)
    expect(reorderSites).toHaveBeenCalledWith(LUDO_ID, [SITE_ID, 'site-b'])
    expect(deleteSite).toHaveBeenCalledWith(LUDO_ID, SITE_ID)
    expect(requireResponsableContext).toHaveBeenCalledTimes(2)
  })

  it('renvoie une erreur de formulaire pour des horaires ou coordonnées invalides', async () => {
    const badHours = siteFields.map<[string, string]>(([key, value]) =>
      key === 'openingHours' ? [key, 'not-json'] : [key, value],
    )
    const badCoordinates = siteFields.map<[string, string]>(([key, value]) =>
      key === 'latitude' ? [key, 'invalide'] : [key, value],
    )

    await expect(actions.create!(event(badHours) as never)).resolves.toMatchObject({ status: 400 })
    await expect(actions.update!(event(badCoordinates) as never)).resolves.toMatchObject({
      status: 400,
    })
    expect(createSiteWithOpeningHours).not.toHaveBeenCalled()
    expect(updateSiteWithOpeningHours).not.toHaveBeenCalled()
  })
})
