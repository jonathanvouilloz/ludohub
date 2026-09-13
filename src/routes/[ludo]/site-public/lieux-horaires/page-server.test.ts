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
  }
})

import { requireLudoContext, requireResponsableContext } from '$lib/server/ludo-context.js'
import {
  createSiteWithOpeningHours,
  deleteSite,
  listSitesWithOpeningHours,
  reorderSites,
  updateSiteWithOpeningHours,
} from '$lib/server/services/sites.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const SITE_ID = '22222222-2222-4222-8222-222222222222'
const context = {
  ludo: { id: LUDO_ID },
  member: { id: 'member-a', ludoId: LUDO_ID, role: 'responsable', isActive: true },
}

function event(fields: Array<[string, string]> = []) {
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
  vi.mocked(deleteSite).mockResolvedValue(undefined)
})

describe('route Site public — lieux et horaires', () => {
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
