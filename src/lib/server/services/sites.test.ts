import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/sites.js', () => ({
  getSiteRowForLudo: vi.fn(),
  insertSiteWithIntervalsAtomic: vi.fn(),
  listActiveSiteRows: vi.fn(),
  listSiteRowsWithOpeningHours: vi.fn(),
  updateSiteWithIntervalsAtomic: vi.fn(),
  updateSiteOrderRows: vi.fn(),
}))

import {
  getSiteRowForLudo,
  insertSiteWithIntervalsAtomic,
  listActiveSiteRows,
  listSiteRowsWithOpeningHours,
  updateSiteWithIntervalsAtomic,
  updateSiteOrderRows,
} from '../db/sites.js'
import {
  createSiteWithOpeningHours,
  normalizeOpeningIntervals,
  reorderSites,
  SiteServiceError,
  updateSiteWithOpeningHours,
  type SiteInput,
} from './sites.js'

const LUDO = 'ludo-a'
const SITE = {
  id: 'site-a',
  ludoId: LUDO,
  slug: 'paquis',
  name: 'Pâquis',
  isPrimary: true,
  isActive: true,
  sortOrder: 4,
  openingIntervals: [],
}

const input: SiteInput = {
  slug: ' Paquis ',
  name: ' Pâquis ',
  isPrimary: true,
  isActive: true,
  openingIntervals: [{ dayOfWeek: 2, opensAt: '14:00', closesAt: '18:00' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listActiveSiteRows).mockResolvedValue([SITE] as never)
  vi.mocked(listSiteRowsWithOpeningHours).mockResolvedValue([SITE] as never)
  vi.mocked(getSiteRowForLudo).mockResolvedValue(SITE as never)
  vi.mocked(insertSiteWithIntervalsAtomic).mockResolvedValue(undefined)
  vi.mocked(updateSiteWithIntervalsAtomic).mockResolvedValue(undefined)
})

describe('normalizeOpeningIntervals', () => {
  it('normalise et trie les jours ISO puis les heures', () => {
    expect(
      normalizeOpeningIntervals([
        { dayOfWeek: 5, opensAt: '14:00', closesAt: '18:00' },
        { dayOfWeek: 2, opensAt: '09:00', closesAt: '12:00' },
      ]),
    ).toEqual([
      { dayOfWeek: 2, opensAt: '09:00', closesAt: '12:00', sortOrder: 0 },
      { dayOfWeek: 5, opensAt: '14:00', closesAt: '18:00', sortOrder: 1 },
    ])
  })

  it('refuse les intervalles qui se chevauchent', () => {
    expect(() =>
      normalizeOpeningIntervals([
        { dayOfWeek: 1, opensAt: '09:00', closesAt: '12:00' },
        { dayOfWeek: 1, opensAt: '11:59', closesAt: '13:00' },
      ]),
    ).toThrow(/chevauchent/)
  })

  it('accepte deux intervalles adjacents', () => {
    expect(
      normalizeOpeningIntervals([
        { dayOfWeek: 1, opensAt: '09:00', closesAt: '12:00' },
        { dayOfWeek: 1, opensAt: '12:00', closesAt: '13:00' },
      ]),
    ).toHaveLength(2)
  })
})

describe('createSiteWithOpeningHours', () => {
  it('rend automatiquement le premier lieu actif principal', async () => {
    vi.mocked(listActiveSiteRows).mockResolvedValue([])
    await createSiteWithOpeningHours(LUDO, { ...input, isPrimary: false })
    expect(insertSiteWithIntervalsAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        ludoId: LUDO,
        slug: 'paquis',
        isPrimary: true,
        isActive: true,
        sortOrder: 5,
      }),
      [{ dayOfWeek: 2, opensAt: '14:00', closesAt: '18:00', sortOrder: 0 }],
      true,
    )
  })
})

describe('updateSiteWithOpeningHours', () => {
  it('scope toutes les écritures par tenant et remplace les horaires validés', async () => {
    await updateSiteWithOpeningHours(LUDO, 'site-a', input)
    expect(getSiteRowForLudo).toHaveBeenCalledWith('site-a', LUDO)
    expect(updateSiteWithIntervalsAtomic).toHaveBeenCalledWith(
      'site-a',
      LUDO,
      expect.objectContaining({ name: 'Pâquis' }),
      [{ dayOfWeek: 2, opensAt: '14:00', closesAt: '18:00', sortOrder: 0 }],
      true,
    )
    expect(vi.mocked(updateSiteWithIntervalsAtomic).mock.calls[0][2]).not.toHaveProperty('slug')
  })

  it('refuse un changement de slug pendant la compatibilité legacy', async () => {
    await expect(
      updateSiteWithOpeningHours(LUDO, 'site-a', { ...input, slug: 'nouveau-slug' }),
    ).rejects.toThrow(/slug.*ne peut pas être modifié/i)
    expect(updateSiteWithIntervalsAtomic).not.toHaveBeenCalled()
  })

  it("refuse la désactivation du lieu principal avant d'en choisir un autre", async () => {
    await expect(
      updateSiteWithOpeningHours(LUDO, 'site-a', { ...input, isActive: false }),
    ).rejects.toThrow(SiteServiceError)
    expect(updateSiteWithIntervalsAtomic).not.toHaveBeenCalled()
  })

  it("ne révèle ni ne modifie un lieu d'un autre tenant", async () => {
    vi.mocked(getSiteRowForLudo).mockResolvedValue(undefined)
    await expect(updateSiteWithOpeningHours(LUDO, 'site-b', input)).rejects.toThrow(
      'Lieu introuvable.',
    )
    expect(updateSiteWithIntervalsAtomic).not.toHaveBeenCalled()
  })
})

describe('reorderSites', () => {
  it("refuse un identifiant qui n'appartient pas au tenant", async () => {
    await expect(reorderSites(LUDO, ['site-b'])).rejects.toThrow(/ne correspond pas/)
    expect(updateSiteOrderRows).not.toHaveBeenCalled()
  })

  it('réordonne un ensemble tenant complet', async () => {
    await reorderSites(LUDO, ['site-a'])
    expect(updateSiteOrderRows).toHaveBeenCalledWith(LUDO, ['site-a'])
  })
})
