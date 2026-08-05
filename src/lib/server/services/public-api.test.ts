import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getLudoBySlug, isPublicSiteEnabled, listSiteRowsWithOpeningHours, listVisible } =
  vi.hoisted(() => ({
    getLudoBySlug: vi.fn(),
    isPublicSiteEnabled: vi.fn(),
    listSiteRowsWithOpeningHours: vi.fn(),
    listVisible: vi.fn(),
  }))

vi.mock('../db/ludotheques.js', () => ({ getLudoBySlug }))
vi.mock('../db/sites.js', () => ({ listSiteRowsWithOpeningHours }))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled }))
vi.mock('./public-announcements.js', () => ({ listVisiblePublicAnnouncements: listVisible }))

import { getPublicAnnouncementsByLudoSlug, getPublicSitesByLudoSlug } from './public-api.js'

const ludo = { id: '10000000-0000-4000-8000-000000000001', slug: 'demo', name: 'Démo' }

beforeEach(() => {
  vi.clearAllMocks()
  getLudoBySlug.mockResolvedValue(ludo)
  isPublicSiteEnabled.mockResolvedValue(true)
  listSiteRowsWithOpeningHours.mockResolvedValue([])
  listVisible.mockResolvedValue([])
})

describe('getPublicAnnouncementsByLudoSlug', () => {
  it('résout un lieu actif par son slug et ne transmet que son identifiant interne', async () => {
    listSiteRowsWithOpeningHours.mockResolvedValueOnce([
      { id: 'site-a', slug: 'paquis', isActive: true },
      { id: 'site-b', slug: 'secheron', isActive: false },
    ])
    listVisible.mockResolvedValueOnce([
      {
        id: '30000000-0000-4000-8000-000000000001',
        title: 'Fermeture',
        message: 'Fermé jeudi.',
        publishedAt: new Date('2026-08-05T10:00:00.000Z'),
        targets: [
          {
            siteId: 'site-a',
            site: { id: 'site-a', slug: 'paquis', name: 'Pâquis', isActive: true },
          },
        ],
      },
    ])

    await expect(getPublicAnnouncementsByLudoSlug('demo', 'paquis')).resolves.toEqual({
      ludo: { slug: 'demo', name: 'Démo' },
      site: 'paquis',
      announcements: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          title: 'Fermeture',
          message: 'Fermé jeudi.',
          publishedAt: '2026-08-05T10:00:00.000Z',
          sites: [{ id: 'site-a', slug: 'paquis', name: 'Pâquis' }],
        },
      ],
    })
    expect(listVisible).toHaveBeenCalledWith(ludo.id, 'site-a')
  })

  it('retourne null pour un slug de lieu inactif ou inconnu', async () => {
    listSiteRowsWithOpeningHours.mockResolvedValueOnce([
      { id: 'site-b', slug: 'secheron', isActive: false },
    ])
    await expect(getPublicAnnouncementsByLudoSlug('demo', 'secheron')).resolves.toBeNull()
    expect(listVisible).not.toHaveBeenCalled()
  })
})

describe('getPublicSitesByLudoSlug', () => {
  it('ne révèle pas un tenant inconnu ou désactivé', async () => {
    getLudoBySlug.mockResolvedValueOnce(undefined)
    await expect(getPublicSitesByLudoSlug('inconnu')).resolves.toBeNull()
    expect(isPublicSiteEnabled).not.toHaveBeenCalled()

    isPublicSiteEnabled.mockResolvedValueOnce(false)
    await expect(getPublicSitesByLudoSlug('demo')).resolves.toBeNull()
    expect(listSiteRowsWithOpeningHours).not.toHaveBeenCalled()
  })

  it('expose uniquement les lieux actifs et les champs publics', async () => {
    listSiteRowsWithOpeningHours.mockResolvedValue([
      {
        id: '20000000-0000-4000-8000-000000000001',
        ludoId: ludo.id,
        slug: 'paquis',
        name: 'Pâquis',
        address: '1 rue du Jeu',
        postalCode: '1201',
        city: 'Genève',
        phone: null,
        email: null,
        accessInfo: null,
        latitude: null,
        longitude: null,
        isPrimary: true,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        openingIntervals: [
          { dayOfWeek: 2, opensAt: '14:00:00', closesAt: '18:30:00', sortOrder: 0 },
        ],
      },
      {
        id: '20000000-0000-4000-8000-000000000002',
        slug: 'ferme',
        name: 'Fermé',
        isActive: false,
        openingIntervals: [],
      },
    ])

    await expect(getPublicSitesByLudoSlug('demo')).resolves.toEqual({
      ludo: { slug: 'demo', name: 'Démo' },
      sites: [
        expect.objectContaining({
          id: '20000000-0000-4000-8000-000000000001',
          slug: 'paquis',
          openingIntervals: [{ dayOfWeek: 2, opensAt: '14:00', closesAt: '18:30' }],
        }),
      ],
    })
  })
})
