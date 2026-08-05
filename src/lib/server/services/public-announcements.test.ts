import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/public-announcements.js', () => ({
  deletePublicAnnouncementRow: vi.fn(),
  getPublicAnnouncementRowForLudo: vi.fn(),
  insertPublicAnnouncementAtomic: vi.fn(),
  listPublicAnnouncementRows: vi.fn(),
  listPublishedPublicAnnouncementRows: vi.fn(),
  updatePublicAnnouncementAtomic: vi.fn(),
  updatePublicAnnouncementPublicationRow: vi.fn(),
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: vi.fn() }))
vi.mock('./public-site.js', () => ({
  isPublicSiteEnabled: vi.fn(),
  validatePublicSiteTargets: vi.fn(),
}))

import {
  deletePublicAnnouncementRow,
  getPublicAnnouncementRowForLudo,
  insertPublicAnnouncementAtomic,
  listPublicAnnouncementRows,
  listPublishedPublicAnnouncementRows,
  updatePublicAnnouncementAtomic,
  updatePublicAnnouncementPublicationRow,
} from '../db/public-announcements.js'
import { listActiveSiteRows } from '../db/sites.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'
import {
  createPublicAnnouncement,
  getPublicAnnouncement,
  listPublicAnnouncementsForManagement,
  listVisiblePublicAnnouncements,
  PublicAnnouncementServiceError,
  setPublicAnnouncementActive,
  sortPublicAnnouncements,
  updatePublicAnnouncement,
} from './public-announcements.js'

const LUDO = 'ludo-a'
const OTHER_LUDO = 'ludo-b'
const MEMBER = 'member-a'
const NOW = new Date('2026-08-05T12:00:00Z')
const FIRST_PUBLICATION = new Date('2026-08-01T09:00:00Z')
const SITE_A = { id: 'site-a', ludoId: LUDO, isActive: true, isPrimary: true }
const SITE_B = { id: 'site-b', ludoId: LUDO, isActive: true, isPrimary: false }

function announcement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'announcement-a',
    ludoId: LUDO,
    title: 'Info pratique',
    message: 'La ludothèque ouvre à 14 h.',
    status: 'draft',
    revision: 1,
    authorMemberId: MEMBER,
    updatedByMemberId: MEMBER,
    publishedByMemberId: null,
    publishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    author: null,
    publishedBy: null,
    targets: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(validatePublicSiteTargets).mockResolvedValue([])
  vi.mocked(listActiveSiteRows).mockResolvedValue([SITE_A, SITE_B] as never)
  vi.mocked(getPublicAnnouncementRowForLudo).mockResolvedValue(announcement() as never)
  vi.mocked(insertPublicAnnouncementAtomic).mockResolvedValue(announcement() as never)
  vi.mocked(updatePublicAnnouncementAtomic).mockResolvedValue(announcement() as never)
  vi.mocked(updatePublicAnnouncementPublicationRow).mockResolvedValue(announcement() as never)
  vi.mocked(deletePublicAnnouncementRow).mockResolvedValue({ id: 'announcement-a' })
  vi.mocked(listPublicAnnouncementRows).mockResolvedValue([])
  vi.mocked(listPublishedPublicAnnouncementRows).mockResolvedValue([])
})

describe('CRUD tenant-scoped', () => {
  it.each([
    ['tous les lieux', 'all' as const, []],
    ['une cible explicite', 'explicit' as const, ['site-a']],
    ['plusieurs cibles explicites', 'explicit' as const, ['site-a', 'site-b']],
  ])('crée une annonce pour %s', async (_label, targetMode, siteIds) => {
    await createPublicAnnouncement(
      LUDO,
      MEMBER,
      { title: '  Fermeture  ', message: '  Fermé vendredi.  ', targetMode, siteIds } as never,
      NOW,
    )

    if (targetMode === 'explicit') {
      expect(validatePublicSiteTargets).toHaveBeenCalledWith(LUDO, siteIds)
    } else {
      expect(validatePublicSiteTargets).not.toHaveBeenCalled()
    }
    expect(insertPublicAnnouncementAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        ludoId: LUDO,
        title: 'Fermeture',
        message: 'Fermé vendredi.',
        status: 'draft',
        publishedAt: null,
        publishedByMemberId: null,
      }),
      siteIds,
    )
  })

  it('met à jour le contenu et N cibles dans le même tenant', async () => {
    await updatePublicAnnouncement(
      'announcement-a',
      LUDO,
      {
        title: 'Titre modifié',
        targetMode: 'explicit',
        siteIds: ['site-a', 'site-b'],
      },
      MEMBER,
      1,
      NOW,
    )

    expect(updatePublicAnnouncementAtomic).toHaveBeenCalledWith(
      'announcement-a',
      LUDO,
      1,
      expect.objectContaining({
        title: 'Titre modifié',
        updatedByMemberId: MEMBER,
        updatedAt: NOW,
      }),
      ['site-a', 'site-b'],
    )
  })

  it("ne retrouve pas l'annonce d'un autre tenant", async () => {
    vi.mocked(getPublicAnnouncementRowForLudo).mockResolvedValue(undefined)
    await expect(getPublicAnnouncement('announcement-a', OTHER_LUDO)).rejects.toThrow(
      PublicAnnouncementServiceError,
    )
    expect(getPublicAnnouncementRowForLudo).toHaveBeenCalledWith('announcement-a', OTHER_LUDO)
  })

  it('rejette les textes hors limites avant écriture', async () => {
    await expect(
      createPublicAnnouncement(
        LUDO,
        MEMBER,
        { title: ' ', message: 'ok', targetMode: 'all', siteIds: [] },
        NOW,
      ),
    ).rejects.toThrow(/titre/)
    expect(insertPublicAnnouncementAtomic).not.toHaveBeenCalled()
  })

  it('rejette un ciblage explicite vide sans le convertir en tous les lieux', async () => {
    await expect(
      createPublicAnnouncement(
        LUDO,
        MEMBER,
        { title: 'Titre', message: 'Message', targetMode: 'explicit', siteIds: [] },
        NOW,
      ),
    ).rejects.toThrow(/au moins un lieu actif/)
    expect(insertPublicAnnouncementAtomic).not.toHaveBeenCalled()
  })

  it('rejette des ids avec le mode tous les lieux', async () => {
    await expect(
      createPublicAnnouncement(
        LUDO,
        MEMBER,
        { title: 'Titre', message: 'Message', targetMode: 'all', siteIds: ['site-a'] } as never,
        NOW,
      ),
    ).rejects.toThrow(/liste de lieux vide/)
  })

  it('ne transforme jamais une cible inactive en ciblage global', async () => {
    vi.mocked(validatePublicSiteTargets).mockRejectedValue(new Error('lieu inactif'))
    await expect(
      updatePublicAnnouncement(
        'announcement-a',
        LUDO,
        { targetMode: 'explicit', siteIds: ['site-inactive'] },
        MEMBER,
        1,
        NOW,
      ),
    ).rejects.toThrow(/inactif/)
    expect(updatePublicAnnouncementAtomic).not.toHaveBeenCalled()
  })

  it('refuse une mise à jour fondée sur une révision périmée', async () => {
    vi.mocked(getPublicAnnouncementRowForLudo).mockResolvedValue(
      announcement({ revision: 2 }) as never,
    )
    await expect(
      updatePublicAnnouncement('announcement-a', LUDO, { title: 'Périmé' }, MEMBER, 1, NOW),
    ).rejects.toThrow(/Rechargez/)
    expect(updatePublicAnnouncementAtomic).not.toHaveBeenCalled()
  })

  it('refuse une mise à jour si une autre écriture gagne après la lecture', async () => {
    vi.mocked(updatePublicAnnouncementAtomic).mockResolvedValue(undefined)
    await expect(
      updatePublicAnnouncement('announcement-a', LUDO, { title: 'Concurrent' }, MEMBER, 1, NOW),
    ).rejects.toThrow(/Rechargez/)
  })
})

describe('activation manuelle', () => {
  it('refuse un toggle fondé sur une révision périmée', async () => {
    vi.mocked(getPublicAnnouncementRowForLudo).mockResolvedValue(
      announcement({ revision: 2 }) as never,
    )
    await expect(
      setPublicAnnouncementActive('announcement-a', LUDO, true, MEMBER, 1, NOW),
    ).rejects.toThrow(/Rechargez/)
    expect(updatePublicAnnouncementPublicationRow).not.toHaveBeenCalled()
  })

  it('refuse une activation si une cible est devenue inactive', async () => {
    vi.mocked(getPublicAnnouncementRowForLudo).mockResolvedValue(
      announcement({ targets: [{ siteId: 'site-b', ludoId: LUDO }] }) as never,
    )
    vi.mocked(validatePublicSiteTargets).mockRejectedValue(new Error('lieu inactif'))

    await expect(
      setPublicAnnouncementActive('announcement-a', LUDO, true, MEMBER, 1, NOW),
    ).rejects.toThrow(/inactif/)
    expect(updatePublicAnnouncementPublicationRow).not.toHaveBeenCalled()
  })

  it('exige un lieu actif pour activer une annonce visant tous les lieux', async () => {
    vi.mocked(listActiveSiteRows).mockResolvedValue([])
    await expect(
      setPublicAnnouncementActive('announcement-a', LUDO, true, MEMBER, 1, NOW),
    ).rejects.toThrow(/au moins un lieu actif/)
  })

  it("rend l'activation répétée idempotente", async () => {
    const published = announcement({
      status: 'published',
      publishedAt: FIRST_PUBLICATION,
      publishedByMemberId: MEMBER,
    })
    vi.mocked(getPublicAnnouncementRowForLudo).mockResolvedValue(published as never)

    await expect(
      setPublicAnnouncementActive('announcement-a', LUDO, true, MEMBER, 1, NOW),
    ).resolves.toEqual({
      announcement: published,
      changed: false,
      previousStatus: 'published',
    })
    expect(updatePublicAnnouncementPublicationRow).not.toHaveBeenCalled()
    expect(validatePublicSiteTargets).not.toHaveBeenCalled()
    expect(listActiveSiteRows).not.toHaveBeenCalled()
  })

  it('conserve la première publication lors d’une republication', async () => {
    vi.mocked(getPublicAnnouncementRowForLudo)
      .mockResolvedValueOnce(
        announcement({
          status: 'hidden',
          publishedAt: FIRST_PUBLICATION,
          publishedByMemberId: 'first-publisher',
        }) as never,
      )
      .mockResolvedValueOnce(
        announcement({
          status: 'published',
          publishedAt: FIRST_PUBLICATION,
          publishedByMemberId: 'first-publisher',
        }) as never,
      )

    await setPublicAnnouncementActive('announcement-a', LUDO, true, MEMBER, 1, NOW)
    expect(updatePublicAnnouncementPublicationRow).toHaveBeenCalledWith(
      'announcement-a',
      LUDO,
      'hidden',
      1,
      expect.objectContaining({
        status: 'published',
        publishedAt: FIRST_PUBLICATION,
        publishedByMemberId: 'first-publisher',
        updatedByMemberId: MEMBER,
      }),
    )
  })

  it('refuse une activation si le CAS est perdu face à une modification concurrente', async () => {
    vi.mocked(updatePublicAnnouncementPublicationRow).mockResolvedValue(undefined)

    await expect(
      setPublicAnnouncementActive('announcement-a', LUDO, true, MEMBER, 1, NOW),
    ).rejects.toThrow(/Rechargez/)
  })
})

describe('lecture publique', () => {
  it("ne lit aucun contenu lorsque le module public n'est pas activé", async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(listVisiblePublicAnnouncements(LUDO)).resolves.toEqual([])
    expect(listPublishedPublicAnnouncementRows).not.toHaveBeenCalled()
  })

  it('expose zéro/une/N cibles seulement sur les lieux encore actifs', async () => {
    const allSites = announcement({
      id: 'all',
      createdAt: new Date('2026-08-01T00:00:00Z'),
      targets: [],
    })
    const oneActive = announcement({
      id: 'one-active',
      createdAt: new Date('2026-08-03T00:00:00Z'),
      targets: [{ siteId: 'site-a', ludoId: LUDO }],
    })
    const manyWithOneActive = announcement({
      id: 'many',
      createdAt: new Date('2026-08-02T00:00:00Z'),
      targets: [
        { siteId: 'site-a', ludoId: LUDO },
        { siteId: 'site-inactive', ludoId: LUDO },
      ],
    })
    const inactiveOnly = announcement({
      id: 'inactive',
      createdAt: new Date('2026-08-04T00:00:00Z'),
      targets: [{ siteId: 'site-inactive', ludoId: LUDO }],
    })
    vi.mocked(listPublishedPublicAnnouncementRows).mockResolvedValue([
      allSites,
      inactiveOnly,
      manyWithOneActive,
      oneActive,
    ] as never)
    vi.mocked(listActiveSiteRows).mockResolvedValue([SITE_A] as never)

    const visible = await listVisiblePublicAnnouncements(LUDO)
    expect(visible.map((item) => item.id)).toEqual(['one-active', 'many', 'all'])
  })

  it('valide un filtre de lieu avec le service Lot 1', async () => {
    await listVisiblePublicAnnouncements(LUDO, 'site-a')
    expect(validatePublicSiteTargets).toHaveBeenCalledWith(LUDO, ['site-a'])
  })

  it('retourne une liste vide pour un filtre de lieu public inactif ou inconnu', async () => {
    vi.mocked(validatePublicSiteTargets).mockRejectedValue(new Error('lieu inactif'))
    await expect(listVisiblePublicAnnouncements(LUDO, 'site-inactive')).resolves.toEqual([])
    expect(listPublishedPublicAnnouncementRows).not.toHaveBeenCalled()
  })
})

describe('tri déterministe', () => {
  it('trie par date de création puis identifiant', async () => {
    const older = new Date('2026-08-01T00:00:00Z')
    const newer = new Date('2026-08-02T00:00:00Z')
    const rows = [
      announcement({ id: 'z', createdAt: older }),
      announcement({ id: 'b', createdAt: newer }),
      announcement({ id: 'a', createdAt: newer }),
      announcement({ id: 'low', createdAt: new Date('2026-07-31T00:00:00Z') }),
    ]
    expect(sortPublicAnnouncements(rows).map((row) => row.id)).toEqual(['a', 'b', 'z', 'low'])

    vi.mocked(listPublicAnnouncementRows).mockResolvedValue(rows as never)
    await expect(listPublicAnnouncementsForManagement(LUDO)).resolves.toEqual(
      sortPublicAnnouncements(rows),
    )
  })
})
