import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  getPublished: vi.fn(),
  insert: vi.fn(),
  list: vi.fn(),
  listVisible: vi.fn(),
  update: vi.fn(),
  publication: vi.fn(),
  remove: vi.fn(),
  activeSites: vi.fn(),
  enabled: vi.fn(),
  validateTargets: vi.fn(),
}))

vi.mock('../db/public-top-threes.js', () => ({
  getPublicTopThreeRowForLudo: mocks.get,
  getPublishedPublicTopThreeRowBySlug: mocks.getPublished,
  insertPublicTopThreeAtomic: mocks.insert,
  listPublicTopThreeRows: mocks.list,
  listVisiblePublicTopThreeSummaryRows: mocks.listVisible,
  updatePublicTopThreeAtomic: mocks.update,
  updatePublicTopThreePublicationRow: mocks.publication,
  deleteDraftPublicTopThreeRow: mocks.remove,
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: mocks.activeSites }))
vi.mock('./public-site.js', () => ({
  isPublicSiteEnabled: mocks.enabled,
  validatePublicSiteTargets: mocks.validateTargets,
}))

import {
  createPublicTopThree,
  deleteDraftPublicTopThree,
  getVisiblePublicTopThreeBySlug,
  hidePublicTopThree,
  listVisiblePublicTopThreeSummaries,
  normalizePublicTopThreeSlug,
  publishPublicTopThree,
  updatePublicTopThree,
  validatePublicTopThreeGames,
} from './public-top-threes.js'

const LUDO = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const MEMBER = '00000000-0000-4000-8000-000000000003'
const NOW = new Date('2026-08-05T12:00:00Z')
const FIRST = new Date('2026-07-01T12:00:00Z')
const games = [{ name: 'A' }, { name: 'B', description: '**Bien**' }, { name: 'C' }]

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'top-a',
    ludoId: LUDO,
    slug: 'jeux-cooperatifs',
    theme: 'Jeux coopératifs',
    games,
    status: 'draft',
    revision: 1,
    authorMemberId: MEMBER,
    updatedByMemberId: MEMBER,
    publishedByMemberId: null,
    publishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    targets: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue(item())
  mocks.insert.mockResolvedValue(item())
  mocks.update.mockResolvedValue(item({ revision: 2 }))
  mocks.publication.mockResolvedValue(item({ revision: 2 }))
  mocks.remove.mockResolvedValue({ id: 'top-a' })
  mocks.enabled.mockResolvedValue(true)
  mocks.activeSites.mockResolvedValue([{ id: 'site-a', ludoId: LUDO, isActive: true }])
  mocks.validateTargets.mockResolvedValue(undefined)
  mocks.listVisible.mockResolvedValue([])
})

describe('validation Top 3', () => {
  it('normalise le slug et conserve les trois positions', () => {
    expect(normalizePublicTopThreeSlug('Été & Famille')).toBe('ete-famille')
    expect(validatePublicTopThreeGames(games).map((game) => game.name)).toEqual(['A', 'B', 'C'])
  })

  it.each([
    [[]],
    [[{ name: 'A' }]],
    [[{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]],
  ])('refuse toute sélection qui ne contient pas exactement trois jeux', (invalid) =>
    expect(() => validatePublicTopThreeGames(invalid as never)).toThrow(/exactement trois/),
  )

  it('rejette champs inconnus, noms invalides, HTML et schémas Markdown dangereux', () => {
    expect(() =>
      validatePublicTopThreeGames([{ name: 'A', catalogId: 'x' } as never, ...games.slice(1)]),
    ).toThrow(/champ inconnu/)
    expect(() => validatePublicTopThreeGames([{ name: '' }, ...games.slice(1)])).toThrow(
      /nom du jeu/,
    )
    expect(() =>
      validatePublicTopThreeGames([{ name: 'A', description: '<b>x</b>' }, ...games.slice(1)]),
    ).toThrow(/HTML/)
    expect(() =>
      validatePublicTopThreeGames([
        { name: 'A', description: '[x](javascript:alert)' },
        ...games.slice(1),
      ]),
    ).toThrow(/lien non autorisé/)
  })

  it.each([
    ['', /nom du jeu/],
    ['   \t\n', /nom du jeu/],
    ['x'.repeat(161), /nom du jeu/],
  ])('rejette un nom vide, blanc ou trop long', (name, message) => {
    expect(() => validatePublicTopThreeGames([{ name }, ...games.slice(1)])).toThrow(message)
  })

  it.each([
    ['', /description/],
    ['   \t\n', /description/],
    ['x'.repeat(2001), /description/],
  ])('rejette une description présente vide, blanche ou trop longue', (description, message) => {
    expect(() =>
      validatePublicTopThreeGames([{ name: 'A', description }, ...games.slice(1)]),
    ).toThrow(message)
  })
})

describe('écriture et ciblage', () => {
  it('crée un brouillon tenant-safe avec ciblage explicite', async () => {
    await createPublicTopThree(
      LUDO,
      MEMBER,
      {
        slug: 'Été',
        theme: 'En famille',
        games,
        targetMode: 'explicit',
        siteIds: ['site-a'],
      },
      NOW,
    )
    expect(mocks.validateTargets).toHaveBeenCalledWith(LUDO, ['site-a'])
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ ludoId: LUDO, slug: 'ete', games, status: 'draft', revision: 1 }),
      ['site-a'],
    )
  })

  it('refuse explicit vide, all non vide et doublons', async () => {
    const base = { slug: 'x', theme: 'Thème', games }
    await expect(
      createPublicTopThree(LUDO, MEMBER, { ...base, targetMode: 'explicit', siteIds: [] }),
    ).rejects.toThrow(/au moins un/)
    await expect(
      createPublicTopThree(LUDO, MEMBER, { ...base, targetMode: 'all', siteIds: ['x'] } as never),
    ).rejects.toThrow(/liste vide/)
    await expect(
      createPublicTopThree(LUDO, MEMBER, { ...base, targetMode: 'explicit', siteIds: ['x', 'x'] }),
    ).rejects.toThrow(/plusieurs fois/)
  })

  it('isole la lecture de gestion par tenant', async () => {
    mocks.get.mockResolvedValue(undefined)
    await expect(updatePublicTopThree('top-a', OTHER, { theme: 'X' }, MEMBER, 1)).rejects.toThrow(
      /introuvable/,
    )
    expect(mocks.get).toHaveBeenCalledWith('top-a', OTHER)
  })

  it('fige le slug après première publication mais permet de modifier les jeux', async () => {
    mocks.get.mockResolvedValue(
      item({ status: 'hidden', publishedAt: FIRST, publishedByMemberId: MEMBER }),
    )
    await expect(updatePublicTopThree('top-a', LUDO, { slug: 'autre' }, MEMBER, 1)).rejects.toThrow(
      /slug/,
    )
    await updatePublicTopThree('top-a', LUDO, { games: [...games].reverse() }, MEMBER, 1)
    expect(mocks.update).toHaveBeenCalledWith(
      'top-a',
      LUDO,
      1,
      expect.objectContaining({ games: [...games].reverse() }),
      [],
    )
  })

  it('gère CAS perdu et collision de slug', async () => {
    mocks.get.mockResolvedValueOnce(item({ revision: 2 }))
    await expect(updatePublicTopThree('top-a', LUDO, { theme: 'X' }, MEMBER, 1)).rejects.toThrow(
      /Rechargez/,
    )
    mocks.get.mockResolvedValueOnce(item())
    mocks.update.mockResolvedValueOnce(undefined)
    await expect(updatePublicTopThree('top-a', LUDO, { theme: 'X' }, MEMBER, 1)).rejects.toThrow(
      /Rechargez/,
    )
    mocks.get.mockResolvedValueOnce(item())
    mocks.update.mockRejectedValueOnce({ code: '23505' })
    await expect(updatePublicTopThree('top-a', LUDO, { slug: 'pris' }, MEMBER, 1)).rejects.toThrow(
      /slug est déjà utilisé/,
    )
  })
})

describe('publication et suppression', () => {
  it('exige module et cibles actives puis conserve le premier publicateur', async () => {
    mocks.enabled.mockResolvedValueOnce(false)
    await expect(publishPublicTopThree('top-a', LUDO, MEMBER, 1, NOW)).rejects.toThrow(
      /module public/,
    )
    mocks.get.mockResolvedValue(
      item({ status: 'hidden', publishedAt: FIRST, publishedByMemberId: OTHER }),
    )
    await publishPublicTopThree('top-a', LUDO, MEMBER, 1, NOW)
    expect(mocks.publication).toHaveBeenCalledWith(
      'top-a',
      LUDO,
      'hidden',
      1,
      expect.objectContaining({ publishedAt: FIRST, publishedByMemberId: OTHER }),
    )
  })

  it('refuse de masquer un brouillon et rend les transitions idempotentes', async () => {
    await expect(hidePublicTopThree('top-a', LUDO, MEMBER, 1)).rejects.toThrow(/brouillon/)
    const published = item({
      status: 'published',
      revision: 2,
      publishedAt: FIRST,
      publishedByMemberId: MEMBER,
    })
    mocks.get.mockResolvedValue(published)
    await expect(publishPublicTopThree('top-a', LUDO, MEMBER, 2)).resolves.toEqual({
      topThree: published,
      changed: false,
      previousStatus: 'published',
    })
    expect(mocks.publication).not.toHaveBeenCalled()
  })

  it('supprime uniquement un brouillon avec CAS', async () => {
    await deleteDraftPublicTopThree('top-a', LUDO, 1)
    expect(mocks.remove).toHaveBeenCalledWith('top-a', LUDO, 1)
    mocks.get.mockResolvedValue(item({ status: 'hidden', publishedAt: FIRST }))
    await expect(deleteDraftPublicTopThree('top-a', LUDO, 1)).rejects.toThrow(/jamais publié/)
  })
})

describe('lecture publique', () => {
  it('borne la liste à 20 par défaut et 50 au maximum', async () => {
    await listVisiblePublicTopThreeSummaries(LUDO)
    expect(mocks.listVisible).toHaveBeenLastCalledWith(LUDO, undefined, 20)
    await listVisiblePublicTopThreeSummaries(LUDO, undefined, 500)
    expect(mocks.listVisible).toHaveBeenLastCalledWith(LUDO, undefined, 50)
  })

  it('masque si module/lieu/ciblage ne convient pas et expose un détail valide', async () => {
    mocks.getPublished.mockResolvedValue(
      item({ status: 'published', targets: [{ siteId: 'site-a', ludoId: LUDO }] }),
    )
    await expect(
      getVisiblePublicTopThreeBySlug(LUDO, 'Jeux coopératifs', 'site-a'),
    ).resolves.toEqual(expect.objectContaining({ id: 'top-a' }))
    await expect(
      getVisiblePublicTopThreeBySlug(LUDO, 'jeux-cooperatifs', 'inactive'),
    ).resolves.toBeUndefined()
    mocks.enabled.mockResolvedValue(false)
    await expect(listVisiblePublicTopThreeSummaries(LUDO)).resolves.toEqual([])
  })

  it('ne consulte pas la base pour un slug public invalide', async () => {
    await expect(getVisiblePublicTopThreeBySlug(LUDO, '!!!')).resolves.toBeUndefined()
    expect(mocks.getPublished).not.toHaveBeenCalled()
  })
})
