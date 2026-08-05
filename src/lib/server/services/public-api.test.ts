import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getLudoBySlug,
  isPublicSiteEnabled,
  listSiteRowsWithOpeningHours,
  listVisible,
  listVisibleNews,
  getVisibleNews,
  listVisibleActivities,
  listArchivedActivities,
  getVisibleActivity,
  listVisibleTopThrees,
  getVisibleTopThree,
  listVisibleFaqs,
  listVisibleDocuments,
  getVisibleDocument,
  listVisibleGallery,
  listVisibleProfiles,
  listPublishedDirectory,
} = vi.hoisted(() => ({
  getLudoBySlug: vi.fn(),
  isPublicSiteEnabled: vi.fn(),
  listSiteRowsWithOpeningHours: vi.fn(),
  listVisible: vi.fn(),
  listVisibleNews: vi.fn(),
  getVisibleNews: vi.fn(),
  listVisibleActivities: vi.fn(),
  listArchivedActivities: vi.fn(),
  getVisibleActivity: vi.fn(),
  listVisibleTopThrees: vi.fn(),
  getVisibleTopThree: vi.fn(),
  listVisibleFaqs: vi.fn(),
  listVisibleDocuments: vi.fn(),
  getVisibleDocument: vi.fn(),
  listVisibleGallery: vi.fn(),
  listVisibleProfiles: vi.fn(),
  listPublishedDirectory: vi.fn(),
}))

vi.mock('../db/ludotheques.js', () => ({ getLudoBySlug }))
vi.mock('../db/sites.js', () => ({ listSiteRowsWithOpeningHours }))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled }))
vi.mock('./public-announcements.js', () => ({ listVisiblePublicAnnouncements: listVisible }))
vi.mock('./public-news.js', () => ({
  listVisiblePublicNewsSummaries: listVisibleNews,
  getVisiblePublicNewsBySlug: getVisibleNews,
}))
vi.mock('./public-activities.js', () => ({
  listVisiblePublicActivitySummaries: listVisibleActivities,
  listArchivedPublicActivitySummaries: listArchivedActivities,
  getVisiblePublicActivityBySlug: getVisibleActivity,
}))
vi.mock('./public-top-threes.js', () => ({
  listVisiblePublicTopThreeSummaries: listVisibleTopThrees,
  getVisiblePublicTopThreeBySlug: getVisibleTopThree,
}))
vi.mock('./public-faqs.js', () => ({ listVisiblePublicFaqs: listVisibleFaqs }))
vi.mock('./public-documents.js', () => ({
  listVisiblePublicDocuments: listVisibleDocuments,
  getVisiblePublicDocumentBySlug: getVisibleDocument,
}))
vi.mock('./public-gallery.js', () => ({ listVisiblePublicGallery: listVisibleGallery }))
vi.mock('./public-profiles.js', () => ({ listVisiblePublicProfiles: listVisibleProfiles }))
vi.mock('./public-directory.js', () => ({
  listPublishedPublicDirectory: listPublishedDirectory,
}))

import {
  getPublicAnnouncementsByLudoSlug,
  getPublicNewsByLudoSlug,
  getPublicNewsDetailByLudoSlug,
  getArchivedPublicActivitiesByLudoSlug,
  getPublicActivitiesByLudoSlug,
  getPublicActivityDetailByLudoSlug,
  getPublicTopThreeDetailByLudoSlug,
  getPublicTopThreesByLudoSlug,
  getPublicDocumentDetailByLudoSlug,
  getPublicDocumentsByLudoSlug,
  getPublicFaqsByLudoSlug,
  getPublicGalleryByLudoSlug,
  getPublicProfilesByLudoSlug,
  getPublicSitesByLudoSlug,
  getPublicDirectoryByLudoSlug,
} from './public-api.js'

const ludo = { id: '10000000-0000-4000-8000-000000000001', slug: 'demo', name: 'Démo' }

beforeEach(() => {
  vi.clearAllMocks()
  getLudoBySlug.mockResolvedValue(ludo)
  isPublicSiteEnabled.mockResolvedValue(true)
  listSiteRowsWithOpeningHours.mockResolvedValue([])
  listVisible.mockResolvedValue([])
  listVisibleNews.mockResolvedValue([])
  getVisibleNews.mockResolvedValue(undefined)
  listVisibleActivities.mockResolvedValue([])
  listArchivedActivities.mockResolvedValue([])
  getVisibleActivity.mockResolvedValue(undefined)
  listVisibleTopThrees.mockResolvedValue([])
  getVisibleTopThree.mockResolvedValue(undefined)
  listVisibleFaqs.mockResolvedValue([])
  listVisibleDocuments.mockResolvedValue([])
  getVisibleDocument.mockResolvedValue(undefined)
  listVisibleGallery.mockResolvedValue([])
  listVisibleProfiles.mockResolvedValue([])
  listPublishedDirectory.mockResolvedValue([])
})

describe('galerie et profils publics', () => {
  it('projette la galerie sans clé de stockage', async () => {
    listVisibleGallery.mockResolvedValue([
      {
        id: 'b0000000-0000-4000-8000-000000000001',
        caption: 'Soirée jeux',
        alt: 'Table de jeux',
        sortOrder: 2,
        imageUrl: 'https://blob.test/photo.webp',
        imageStorageKey: 'secret',
        publishedAt: new Date('2026-08-05T09:00:00.000Z'),
      },
    ])
    const result = await getPublicGalleryByLudoSlug('demo', undefined, 10)
    expect(listVisibleGallery).toHaveBeenCalledWith(ludo.id, undefined, 10)
    expect(result?.images[0]).toMatchObject({ alt: 'Table de jeux', sortOrder: 2 })
    expect(result?.images[0]).not.toHaveProperty('imageStorageKey')
  })

  it('sépare équipe et comité sans exposer le membre lié', async () => {
    listVisibleProfiles.mockResolvedValue([
      {
        id: 'c0000000-0000-4000-8000-000000000001',
        section: 'team',
        displayName: 'Alice',
        roleTitle: 'Ludothécaire',
        bioMarkdown: null,
        sortOrder: 1,
        photoUrl: null,
        photoAlt: null,
        memberId: 'internal',
      },
    ])
    const result = await getPublicProfilesByLudoSlug('demo', 'team', undefined, 20)
    expect(listVisibleProfiles).toHaveBeenCalledWith(ludo.id, 'team', undefined, 20)
    expect(result?.profiles[0]).toMatchObject({ displayName: 'Alice', photo: null })
    expect(result?.profiles[0]).not.toHaveProperty('memberId')
  })
})

describe('FAQ et documents publics', () => {
  it('projette la FAQ dans son ordre public sans métadonnées internes', async () => {
    listVisibleFaqs.mockResolvedValue([
      {
        id: '90000000-0000-4000-8000-000000000001',
        question: 'Comment adhérer ?',
        answerMarkdown: 'Sur place.',
        category: 'Adhésion',
        sortOrder: 10,
      },
    ])
    const result = await getPublicFaqsByLudoSlug('demo', undefined, 25)
    expect(listVisibleFaqs).toHaveBeenCalledWith(ludo.id, undefined, 25)
    expect(result?.faqs[0]).toEqual({
      id: '90000000-0000-4000-8000-000000000001',
      question: 'Comment adhérer ?',
      answerMarkdown: 'Sur place.',
      category: 'Adhésion',
      sortOrder: 10,
    })
  })

  it('sépare la projection document de son détail et masque la clé Blob', async () => {
    const row = {
      id: 'a0000000-0000-4000-8000-000000000001',
      slug: 'rapport-2025',
      kind: 'annual_report' as const,
      title: 'Rapport 2025',
      summary: 'Résumé',
      bodyMarkdown: '**Bilan**',
      year: 2025,
      pdfUrl: 'https://blob.test/rapport.pdf',
      pdfFileName: 'rapport-2025.pdf',
      pdfStorageKey: 'private-key',
      publishedAt: new Date('2026-08-05T09:00:00.000Z'),
      targets: [],
    }
    listVisibleDocuments.mockResolvedValue([row])
    getVisibleDocument.mockResolvedValue(row)
    const list = await getPublicDocumentsByLudoSlug('demo')
    const detail = await getPublicDocumentDetailByLudoSlug('demo', 'rapport-2025')
    expect(list?.documents[0]).not.toHaveProperty('bodyMarkdown')
    expect(list?.documents[0]).not.toHaveProperty('pdfStorageKey')
    expect(detail?.document).toMatchObject({
      bodyMarkdown: '**Bilan**',
      pdf: { url: 'https://blob.test/rapport.pdf', fileName: 'rapport-2025.pdf' },
    })
    expect(detail?.document).not.toHaveProperty('pdfStorageKey')
  })
})

const topThreeRow = {
  id: '80000000-0000-4000-8000-000000000001',
  slug: 'jeux-cooperatifs',
  theme: 'Jeux coopératifs',
  isHomepage: true,
  games: [
    { name: 'Jeu A', description: 'A' },
    { name: 'Jeu B', description: null },
    { name: 'Jeu C', description: 'C' },
  ],
  publishedAt: new Date('2026-08-05T09:00:00.000Z'),
  targets: [],
}

describe('Top 3 publics', () => {
  it('borne la liste en base et projette seulement les noms', async () => {
    listVisibleTopThrees.mockResolvedValue([
      { ...topThreeRow, games: topThreeRow.games.map(({ name }) => ({ name })) },
    ])
    const result = await getPublicTopThreesByLudoSlug('demo', undefined, 3)
    expect(listVisibleTopThrees).toHaveBeenCalledWith(ludo.id, undefined, 3)
    expect(result?.topThrees[0]).toEqual({
      id: topThreeRow.id,
      slug: 'jeux-cooperatifs',
      theme: 'Jeux coopératifs',
      isHomepage: true,
      games: [{ name: 'Jeu A' }, { name: 'Jeu B' }, { name: 'Jeu C' }],
      publishedAt: '2026-08-05T09:00:00.000Z',
    })
  })

  it('expose exactement trois descriptions dans le détail sans relation interne', async () => {
    getVisibleTopThree.mockResolvedValue(topThreeRow)
    const result = await getPublicTopThreeDetailByLudoSlug('demo', 'jeux-cooperatifs')
    expect(result?.topThree.games).toHaveLength(3)
    expect(result?.topThree.games[1]).toEqual({ name: 'Jeu B', description: null })
    expect(result?.topThree.isHomepage).toBe(true)
    expect(result?.topThree).not.toHaveProperty('revision')
  })
})

const activityRow = {
  id: '70000000-0000-4000-8000-000000000001',
  slug: 'soiree-jeux',
  title: 'Soirée jeux',
  summary: 'Une soirée ouverte à toutes et tous.',
  body: '**Bienvenue**',
  location: 'Pâquis',
  type: 'recurring' as const,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=FR',
  imageUrl: null,
  imageAlt: null,
  lifecycle: 'active' as const,
  featuredRank: 1,
  publishedAt: new Date('2026-08-05T09:00:00.000Z'),
  dates: [
    {
      startsAt: new Date('2026-10-23T17:00:00.000Z'),
      endsAt: new Date('2026-10-23T20:00:00.000Z'),
    },
  ],
  exceptions: [{ excludedAt: new Date('2026-10-30T18:00:00.000Z'), reason: 'Vacances' }],
}

const activitySummaryRow = {
  ...activityRow,
  dates: [
    {
      startsAt: '2026-10-23T17:00:00.000Z',
      endsAt: '2026-10-23T20:00:00.000Z',
    },
  ],
}

describe('activités publiques', () => {
  it('sépare la liste actuelle des archives et borne en base', async () => {
    listVisibleActivities.mockResolvedValue([activitySummaryRow])
    listArchivedActivities.mockResolvedValue([{ ...activitySummaryRow, lifecycle: 'archived' }])

    const current = await getPublicActivitiesByLudoSlug('demo', undefined, 3)
    const archived = await getArchivedPublicActivitiesByLudoSlug('demo', undefined, 5)

    expect(listVisibleActivities).toHaveBeenCalledWith(ludo.id, undefined, 3)
    expect(listArchivedActivities).toHaveBeenCalledWith(ludo.id, undefined, 5)
    expect(current?.timeZone).toBe('Europe/Zurich')
    expect(current?.activities[0]).toMatchObject({
      slug: 'soiree-jeux',
      lifecycle: 'active',
      schedule: {
        type: 'recurring',
        dates: [{ startsAt: '2026-10-23T17:00:00.000Z' }],
      },
    })
    expect(current?.activities[0]).not.toHaveProperty('bodyMarkdown')
    expect(archived?.activities[0].lifecycle).toBe('archived')
  })

  it('retourne le détail courant ou archivé sans champ interne', async () => {
    getVisibleActivity.mockResolvedValue(activityRow)
    const result = await getPublicActivityDetailByLudoSlug('demo', 'soiree-jeux')
    expect(result?.activity).toMatchObject({
      id: activityRow.id,
      bodyMarkdown: '**Bienvenue**',
      image: null,
    })
    expect(result?.activity).not.toHaveProperty('imageStorageKey')
    expect(getVisibleActivity).toHaveBeenCalledWith(ludo.id, 'soiree-jeux', undefined)
  })
})

const newsRow = {
  id: '60000000-0000-4000-8000-000000000001',
  slug: 'nouvelle',
  title: 'Nouvelle',
  summary: 'Résumé',
  body: '**Contenu**',
  imageUrl: null,
  imageAlt: null,
  publishedAt: new Date('2026-08-05T09:00:00.000Z'),
  targets: [],
}

describe('actualités publiques', () => {
  it('applique la limite par défaut en base et ne sérialise pas le corps dans la liste', async () => {
    const rows = [newsRow, newsRow, newsRow, newsRow]
    listVisibleNews.mockImplementation(
      async (_ludoId: string, _siteId: string | undefined, limit: number) => rows.slice(0, limit),
    )
    const all = await getPublicNewsByLudoSlug('demo')
    const latest = await getPublicNewsByLudoSlug('demo', undefined, 3)
    expect(all?.news).toHaveLength(4)
    expect(latest?.news).toHaveLength(3)
    expect(all?.news[0]).toMatchObject({
      slug: 'nouvelle',
      image: null,
      publishedAt: '2026-08-05T09:00:00.000Z',
    })
    expect(all?.news[0]).not.toHaveProperty('body')
    expect(all?.news[0]).not.toHaveProperty('bodyMarkdown')
    expect(listVisibleNews).toHaveBeenNthCalledWith(1, ludo.id, undefined, 20)
    expect(listVisibleNews).toHaveBeenNthCalledWith(2, ludo.id, undefined, 3)
  })

  it('retourne un détail par slug sans exposer les relations internes', async () => {
    getVisibleNews.mockResolvedValue(newsRow)
    const result = await getPublicNewsDetailByLudoSlug('demo', 'nouvelle')
    expect(result?.news).toEqual(
      expect.objectContaining({
        id: newsRow.id,
        slug: 'nouvelle',
        bodyMarkdown: '**Contenu**',
        sites: [],
      }),
    )
    expect(getVisibleNews).toHaveBeenCalledWith(ludo.id, 'nouvelle', undefined)
  })
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

describe('getPublicDirectoryByLudoSlug', () => {
  it('délègue la projection publiée et bornée au service annuaire', async () => {
    const entries = [
      {
        id: 'directory-a',
        slug: 'paquis',
        name: 'Pâquis',
        directionsUrl: 'https://maps.example/paquis',
        officialUrl: 'https://geneve.example/paquis',
      },
    ]
    listPublishedDirectory.mockResolvedValueOnce(entries)
    await expect(getPublicDirectoryByLudoSlug('demo', 25)).resolves.toEqual({
      ludo: { slug: 'demo', name: ludo.name },
      entries,
    })
    expect(listPublishedDirectory).toHaveBeenCalledWith(ludo.id, 25)
  })
})
