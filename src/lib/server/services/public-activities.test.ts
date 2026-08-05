import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/public-activities.js', () => ({
  getPublicActivityRowForLudo: vi.fn(),
  getVisiblePublicActivityRowBySlug: vi.fn(),
  insertPublicActivityAtomic: vi.fn(),
  listPublicActivityRows: vi.fn(),
  listVisiblePublicActivitySummaryRows: vi.fn(),
  permanentlyDeletePublicActivityRow: vi.fn(),
  updatePublicActivityAtomic: vi.fn(),
  updatePublicActivityFeaturedRow: vi.fn(),
  updatePublicActivityImageRow: vi.fn(),
  updatePublicActivityLifecycleRow: vi.fn(),
  updatePublicActivityPublicationRow: vi.fn(),
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: vi.fn() }))
vi.mock('./public-site.js', () => ({
  isPublicSiteEnabled: vi.fn(),
  validatePublicSiteTargets: vi.fn(),
}))
vi.mock('./public-news.js', () => ({
  normalizePublicNewsSlug: vi.fn((value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  ),
  validatePublicNewsMarkdown: vi.fn((value: string) => value.replace(/\r\n?/g, '\n').trim()),
}))

import {
  getPublicActivityRowForLudo,
  getVisiblePublicActivityRowBySlug,
  insertPublicActivityAtomic,
  listVisiblePublicActivitySummaryRows,
  permanentlyDeletePublicActivityRow,
  updatePublicActivityAtomic,
  updatePublicActivityFeaturedRow,
  updatePublicActivityImageRow,
  updatePublicActivityLifecycleRow,
  updatePublicActivityPublicationRow,
} from '../db/public-activities.js'
import { listActiveSiteRows } from '../db/sites.js'
import { createAuthorizedMediaScope, publicSiteMediaPath } from '../media/paths.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'
import {
  archivePublicActivity,
  authorizePublicActivityMediaScope,
  clearPublicActivityImage,
  createPublicActivity,
  getPublicActivity,
  getVisiblePublicActivityBySlug,
  hidePublicActivity,
  listArchivedPublicActivitySummaries,
  listVisiblePublicActivitySummaries,
  permanentlyDeletePublicActivity,
  publishPublicActivity,
  restorePublicActivity,
  setPublicActivityFeaturedRank,
  setPublicActivityImage,
  trashPublicActivity,
  updatePublicActivity,
} from './public-activities.js'

const LUDO = 'ludo-a'
const OTHER = 'ludo-b'
const MEMBER = 'member-a'
const NOW = new Date('2026-08-05T12:00:00Z')
const START = new Date('2026-09-01T10:00:00Z')
const SITE = { id: 'site-a', ludoId: LUDO, isActive: true, isPrimary: true }
const UUID_LUDO = '00000000-0000-4000-8000-000000000001'
const UUID_ACTIVITY = '00000000-0000-4000-8000-000000000002'
const UUID_MEMBER = '00000000-0000-4000-8000-000000000003'

function activity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'activity-a',
    ludoId: LUDO,
    slug: 'atelier-jeux',
    title: 'Atelier jeux',
    summary: 'Résumé',
    body: '## Contenu',
    location: null,
    type: 'one_off',
    recurrenceRule: null,
    imageUrl: null,
    imageStorageKey: null,
    imageAlt: null,
    status: 'draft',
    lifecycle: 'active',
    featuredRank: null,
    revision: 1,
    authorMemberId: MEMBER,
    updatedByMemberId: MEMBER,
    publishedByMemberId: null,
    publishedAt: null,
    archivedAt: null,
    trashedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    author: null,
    updatedBy: null,
    publishedBy: null,
    targets: [],
    dates: [{ activityId: 'activity-a', ludoId: LUDO, startsAt: START, endsAt: null }],
    exceptions: [],
    ...overrides,
  }
}

function oneOffInput() {
  return {
    slug: 'Atelier Jeux',
    title: 'Atelier jeux',
    summary: 'Résumé',
    body: '## Contenu',
    type: 'one_off' as const,
    dates: [{ startsAt: START }],
    exceptions: [],
    targetMode: 'all' as const,
    siteIds: [] as [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(activity() as never)
  vi.mocked(insertPublicActivityAtomic).mockResolvedValue(activity() as never)
  vi.mocked(updatePublicActivityAtomic).mockResolvedValue(activity({ revision: 2 }) as never)
  vi.mocked(updatePublicActivityPublicationRow).mockResolvedValue(
    activity({ revision: 2 }) as never,
  )
  vi.mocked(updatePublicActivityLifecycleRow).mockResolvedValue(activity({ revision: 2 }) as never)
  vi.mocked(updatePublicActivityFeaturedRow).mockResolvedValue(activity({ revision: 2 }) as never)
  vi.mocked(updatePublicActivityImageRow).mockResolvedValue(activity({ revision: 2 }) as never)
  vi.mocked(permanentlyDeletePublicActivityRow).mockResolvedValue({ id: 'activity-a' })
  vi.mocked(listVisiblePublicActivitySummaryRows).mockResolvedValue([])
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listActiveSiteRows).mockResolvedValue([SITE] as never)
  vi.mocked(validatePublicSiteTargets).mockResolvedValue([])
})

describe('modèles temporels et ciblage', () => {
  it('crée une activité ponctuelle avec date explicite', async () => {
    await createPublicActivity(LUDO, MEMBER, oneOffInput(), NOW)
    expect(insertPublicActivityAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'atelier-jeux', type: 'one_off', recurrenceRule: null }),
      [],
      [{ startsAt: START, endsAt: null }],
      [],
    )
  })

  it('valide récurrence opaque et exceptions explicites', async () => {
    await createPublicActivity(LUDO, MEMBER, {
      ...oneOffInput(),
      type: 'recurring',
      recurrenceRule: 'freq=weekly;byday=MO,WE;count=12',
      exceptions: [{ excludedAt: START, reason: 'Férié' }],
    })
    expect(insertPublicActivityAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12' }),
      [],
      expect.any(Array),
      [{ excludedAt: START, reason: 'Férié' }],
    )
  })

  it('impose zéro date à permanent et refuse CRLF/injection RRULE', async () => {
    await expect(
      createPublicActivity(LUDO, MEMBER, { ...oneOffInput(), type: 'permanent' }),
    ).rejects.toThrow(/permanente/)
    await expect(
      createPublicActivity(LUDO, MEMBER, {
        ...oneOffInput(),
        type: 'recurring',
        recurrenceRule: 'FREQ=WEEKLY\nDROP TABLE x',
      }),
    ).rejects.toThrow(/récurrence est invalide/)
  })

  it.each([
    'FREQ=WEEKLY;INTERVAL=0;COUNT=2',
    'FREQ=WEEKLY;BYDAY=XX;COUNT=2',
    'FREQ=WEEKLY;COUNT=999',
    'FREQ=WEEKLY;UNKNOWN=X;COUNT=2',
    'FREQ=WEEKLY;INTERVAL=2',
    'FREQ=WEEKLY;COUNT=2;UNTIL=20261201T120000Z',
  ])('refuse la RRULE non bornée ou invalide %s', async (recurrenceRule) => {
    await expect(
      createPublicActivity(LUDO, MEMBER, {
        ...oneOffInput(),
        type: 'recurring',
        recurrenceRule,
      }),
    ).rejects.toThrow()
  })

  it.each(['FREQ=WEEKLY;UNTIL=20200101T000000Z', 'FREQ=YEARLY;UNTIL=99991231T235959Z'])(
    'refuse UNTIL hors de la fenêtre UTC de cinq ans: %s',
    async (recurrenceRule) => {
      await expect(
        createPublicActivity(LUDO, MEMBER, {
          ...oneOffInput(),
          type: 'recurring',
          recurrenceRule,
        }),
      ).rejects.toThrow(/cinq années UTC/)
    },
  )

  it('accepte UNTIL exactement cinq années UTC après la première occurrence', async () => {
    await createPublicActivity(LUDO, MEMBER, {
      ...oneOffInput(),
      type: 'recurring',
      recurrenceRule: 'FREQ=YEARLY;UNTIL=20310901T100000Z',
    })
    expect(insertPublicActivityAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ recurrenceRule: 'FREQ=YEARLY;UNTIL=20310901T100000Z' }),
      [],
      expect.any(Array),
      [],
    )
  })

  it('borne dates et exceptions à 366', async () => {
    const dates = Array.from({ length: 367 }, (_, index) => ({
      startsAt: new Date(START.getTime() + index * 86400000),
    }))
    await expect(createPublicActivity(LUDO, MEMBER, { ...oneOffInput(), dates })).rejects.toThrow(
      /maximum 366/,
    )
    const exceptions = Array.from({ length: 367 }, (_, index) => ({
      excludedAt: new Date(START.getTime() + index * 86400000),
    }))
    await expect(
      createPublicActivity(LUDO, MEMBER, {
        ...oneOffInput(),
        type: 'recurring',
        recurrenceRule: 'FREQ=DAILY',
        exceptions,
      }),
    ).rejects.toThrow(/maximum 366/)
  })

  it('rejette ciblage ambigu, doublons de dates et cible inactive', async () => {
    await expect(
      createPublicActivity(LUDO, MEMBER, {
        ...oneOffInput(),
        targetMode: 'explicit',
        siteIds: [],
      }),
    ).rejects.toThrow(/au moins un lieu actif/)
    await expect(
      createPublicActivity(LUDO, MEMBER, {
        ...oneOffInput(),
        dates: [{ startsAt: START }, { startsAt: START }],
      }),
    ).rejects.toThrow(/doublon/)
    vi.mocked(validatePublicSiteTargets).mockRejectedValue(new Error('inactif'))
    await expect(
      createPublicActivity(LUDO, MEMBER, {
        ...oneOffInput(),
        targetMode: 'explicit',
        siteIds: ['inactive'],
      }),
    ).rejects.toThrow(/inactif/)
  })

  it('isole gestion et CAS par tenant/révision', async () => {
    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(undefined)
    await expect(getPublicActivity('activity-a', OTHER)).rejects.toThrow(/introuvable/)
    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(activity({ revision: 2 }) as never)
    await expect(updatePublicActivity('activity-a', LUDO, {}, MEMBER, 1)).rejects.toThrow(
      /Rechargez/,
    )
  })
})

describe('publication, archives et corbeille', () => {
  it('publie seulement module actif + cibles actives et conserve première publication', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(publishPublicActivity('activity-a', LUDO, MEMBER, 1)).rejects.toThrow(/module/)
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
    const first = new Date('2026-08-01T00:00:00Z')
    vi.mocked(getPublicActivityRowForLudo)
      .mockResolvedValueOnce(
        activity({ status: 'hidden', publishedAt: first, publishedByMemberId: 'first' }) as never,
      )
      .mockResolvedValueOnce(activity({ status: 'published', revision: 2 }) as never)
    await publishPublicActivity('activity-a', LUDO, MEMBER, 1, NOW)
    expect(updatePublicActivityPublicationRow).toHaveBeenCalledWith(
      'activity-a',
      LUDO,
      'hidden',
      1,
      expect.objectContaining({ publishedAt: first, publishedByMemberId: 'first' }),
    )
  })

  it('archive publiée sans la cacher, trash la cache, restore reste cachée', async () => {
    const published = activity({
      status: 'published',
      publishedAt: NOW,
      publishedByMemberId: MEMBER,
    })
    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(published as never)
    await archivePublicActivity('activity-a', LUDO, MEMBER, 1, NOW)
    expect(updatePublicActivityLifecycleRow).toHaveBeenCalledWith(
      'activity-a',
      LUDO,
      'active',
      1,
      expect.objectContaining({ lifecycle: 'archived', status: 'published' }),
    )

    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(published as never)
    await trashPublicActivity('activity-a', LUDO, MEMBER, 1, NOW)
    expect(updatePublicActivityLifecycleRow).toHaveBeenLastCalledWith(
      'activity-a',
      LUDO,
      'active',
      1,
      expect.objectContaining({ lifecycle: 'trashed', status: 'hidden' }),
    )

    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(
      activity({ lifecycle: 'trashed', status: 'hidden', trashedAt: NOW }) as never,
    )
    await restorePublicActivity('activity-a', LUDO, MEMBER, 1, NOW)
    expect(updatePublicActivityLifecycleRow).toHaveBeenLastCalledWith(
      'activity-a',
      LUDO,
      'trashed',
      1,
      expect.objectContaining({ lifecycle: 'active', status: 'hidden' }),
    )
  })

  it('supprime définitivement uniquement depuis la corbeille avec CAS', async () => {
    await expect(permanentlyDeletePublicActivity('activity-a', LUDO, 1)).rejects.toThrow(
      /corbeille/,
    )
    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(
      activity({ lifecycle: 'trashed', trashedAt: NOW }) as never,
    )
    await permanentlyDeletePublicActivity('activity-a', LUDO, 1)
    expect(permanentlyDeletePublicActivityRow).toHaveBeenCalledWith('activity-a', LUDO, 1)
  })

  it('réserve featured 1..3 aux activités publiées actives et mappe les conflits', async () => {
    await expect(setPublicActivityFeaturedRank('activity-a', LUDO, MEMBER, 1, 1)).rejects.toThrow(
      /publiée et active/,
    )
    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(
      activity({ status: 'published', publishedAt: NOW, publishedByMemberId: MEMBER }) as never,
    )
    vi.mocked(updatePublicActivityFeaturedRow).mockRejectedValue({ code: '23505' })
    await expect(setPublicActivityFeaturedRank('activity-a', LUDO, MEMBER, 1, 1)).rejects.toThrow(
      /rang.*déjà utilisé/,
    )
  })

  it('revalide les cibles avant toute mise en avant', async () => {
    const published = activity({
      status: 'published',
      publishedAt: NOW,
      publishedByMemberId: MEMBER,
      targets: [{ siteId: 'site-a', ludoId: LUDO }],
    })
    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(published as never)
    vi.mocked(validatePublicSiteTargets).mockRejectedValue(new Error('inactif'))
    await expect(setPublicActivityFeaturedRank('activity-a', LUDO, MEMBER, 1, 1)).rejects.toThrow(
      /inactif/,
    )
    expect(updatePublicActivityFeaturedRow).not.toHaveBeenCalled()

    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(
      activity({ ...published, targets: [] }) as never,
    )
    vi.mocked(listActiveSiteRows).mockResolvedValue([])
    await expect(setPublicActivityFeaturedRank('activity-a', LUDO, MEMBER, 1, 1)).rejects.toThrow(
      /au moins un lieu actif/,
    )
  })

  it('refuse hide sur draft', async () => {
    await expect(hidePublicActivity('activity-a', LUDO, MEMBER, 1)).rejects.toThrow(/brouillon/)
  })
})

describe('média et pages publiques', () => {
  it('valide scope activities/path/MIME et CAS image/clear', async () => {
    const scope = createAuthorizedMediaScope({
      ludoId: UUID_LUDO,
      domain: 'activities',
      entityId: UUID_ACTIVITY,
    })
    const pathname = publicSiteMediaPath({
      scope,
      mediaType: 'image/webp',
      blobId: '00000000-0000-4000-8000-000000000004',
    })
    const current = activity({
      id: UUID_ACTIVITY,
      ludoId: UUID_LUDO,
      imageStorageKey: 'old.webp',
    })
    const updated = activity({ id: UUID_ACTIVITY, ludoId: UUID_LUDO, revision: 2 })
    vi.mocked(getPublicActivityRowForLudo)
      .mockResolvedValueOnce(current as never)
      .mockResolvedValueOnce(updated as never)
    await expect(
      setPublicActivityImage(
        UUID_LUDO,
        UUID_ACTIVITY,
        UUID_MEMBER,
        1,
        scope,
        {
          url: 'https://cdn.test/a.webp',
          downloadUrl: 'https://cdn.test/a.webp',
          pathname,
          contentType: 'image/webp',
          size: 10,
        },
        'Alt',
      ),
    ).resolves.toEqual({ activity: updated, previousStorageKey: 'old.webp' })

    const wrong = createAuthorizedMediaScope({
      ludoId: UUID_LUDO,
      domain: 'news',
      entityId: UUID_ACTIVITY,
    })
    await expect(
      setPublicActivityImage(
        UUID_LUDO,
        UUID_ACTIVITY,
        UUID_MEMBER,
        1,
        wrong,
        {
          url: 'https://cdn.test/a.webp',
          downloadUrl: 'https://cdn.test/a.webp',
          pathname,
          contentType: 'image/webp',
          size: 10,
        },
        'Alt',
      ),
    ).rejects.toThrow(/n'appartient pas/)

    vi.mocked(getPublicActivityRowForLudo)
      .mockResolvedValueOnce(current as never)
      .mockResolvedValueOnce(updated as never)
    await expect(
      clearPublicActivityImage(UUID_LUDO, UUID_ACTIVITY, UUID_MEMBER, 1),
    ).resolves.toEqual({ activity: updated, previousStorageKey: 'old.webp' })
    vi.mocked(getPublicActivityRowForLudo).mockResolvedValue(
      activity({ id: UUID_ACTIVITY, ludoId: UUID_LUDO, revision: 2 }) as never,
    )
    await expect(authorizePublicActivityMediaScope(UUID_LUDO, UUID_ACTIVITY, 1)).rejects.toThrow()
  })

  it('sépare listes courantes/archives, borne à 50 et détail inclut seulement cibles actives', async () => {
    await listVisiblePublicActivitySummaries(LUDO, undefined, 500)
    expect(listVisiblePublicActivitySummaryRows).toHaveBeenCalledWith(LUDO, undefined, 'active', 50)
    await listArchivedPublicActivitySummaries(LUDO)
    expect(listVisiblePublicActivitySummaryRows).toHaveBeenCalledWith(
      LUDO,
      undefined,
      'archived',
      20,
    )

    vi.mocked(getVisiblePublicActivityRowBySlug).mockResolvedValue(
      activity({
        status: 'published',
        targets: [
          { siteId: 'site-a', ludoId: LUDO, site: SITE },
          { siteId: 'inactive', ludoId: LUDO, site: { ...SITE, id: 'inactive', isActive: false } },
        ],
      }) as never,
    )
    const detail = await getVisiblePublicActivityBySlug(LUDO, 'Atelier Jeux')
    expect(detail?.targets.map((target) => target.siteId)).toEqual(['site-a'])
  })
})
