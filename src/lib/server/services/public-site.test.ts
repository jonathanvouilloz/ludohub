import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/public-site.js', () => ({
  getPublicSiteSettingsRow: vi.fn(),
  setPublicSiteEnabledRow: vi.fn(),
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: vi.fn() }))

import { getPublicSiteSettingsRow, setPublicSiteEnabledRow } from '../db/public-site.js'
import { listActiveSiteRows } from '../db/sites.js'
import {
  getPublicSiteState,
  PublicSiteServiceError,
  setPublicSiteEnabled,
  validatePublicSiteTargets,
} from './public-site.js'

const LUDO = 'ludo-a'
const OTHER = 'ludo-b'
const NOW = new Date('2026-08-05T12:00:00Z')
const PRIMARY = { id: 'site-a', ludoId: LUDO, isActive: true, isPrimary: true }
const SECONDARY = { id: 'site-b', ludoId: LUDO, isActive: true, isPrimary: false }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublicSiteSettingsRow).mockResolvedValue(undefined)
  vi.mocked(listActiveSiteRows).mockResolvedValue([PRIMARY, SECONDARY] as never)
  vi.mocked(setPublicSiteEnabledRow).mockResolvedValue({
    id: 'settings-a',
    ludoId: LUDO,
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
  })
})

describe('getPublicSiteState', () => {
  it("considère l'absence de ligne comme désactivée", async () => {
    await expect(getPublicSiteState(LUDO)).resolves.toEqual({
      id: null,
      ludoId: LUDO,
      enabled: false,
      createdAt: null,
      updatedAt: null,
    })
  })
})

describe('setPublicSiteEnabled', () => {
  it('active uniquement le tenant demandé avec un timestamp explicite', async () => {
    await setPublicSiteEnabled(LUDO, true, NOW)
    expect(listActiveSiteRows).toHaveBeenCalledWith(LUDO)
    expect(setPublicSiteEnabledRow).toHaveBeenCalledWith(LUDO, true, NOW)
  })

  it('refuse une activation sans lieu actif', async () => {
    vi.mocked(listActiveSiteRows).mockResolvedValue([])
    await expect(setPublicSiteEnabled(LUDO, true, NOW)).rejects.toThrow(/sans lieu actif/)
    expect(setPublicSiteEnabledRow).not.toHaveBeenCalled()
  })

  it('refuse une activation sans exactement un principal actif', async () => {
    vi.mocked(listActiveSiteRows).mockResolvedValue([
      PRIMARY,
      { ...SECONDARY, isPrimary: true },
    ] as never)
    await expect(setPublicSiteEnabled(LUDO, true, NOW)).rejects.toThrow(PublicSiteServiceError)
    expect(setPublicSiteEnabledRow).not.toHaveBeenCalled()
  })

  it('permet toujours la désactivation sans dépendre de la structure des lieux', async () => {
    await setPublicSiteEnabled(LUDO, false, NOW)
    expect(listActiveSiteRows).not.toHaveBeenCalled()
    expect(setPublicSiteEnabledRow).toHaveBeenCalledWith(LUDO, false, NOW)
  })
})

describe('validatePublicSiteTargets', () => {
  it('retourne les lieux actifs du tenant dans l’ordre demandé', async () => {
    await expect(validatePublicSiteTargets(LUDO, ['site-b', 'site-a'])).resolves.toEqual([
      SECONDARY,
      PRIMARY,
    ])
  })

  it("refuse un lieu d'un autre tenant", async () => {
    vi.mocked(listActiveSiteRows).mockResolvedValue([
      PRIMARY,
      { id: 'site-other', ludoId: OTHER, isActive: true, isPrimary: true },
    ] as never)
    await expect(validatePublicSiteTargets(LUDO, ['site-other'])).rejects.toThrow(
      /n'appartient pas/,
    )
  })

  it('refuse un lieu inactif car la query ne retourne que les actifs', async () => {
    vi.mocked(listActiveSiteRows).mockResolvedValue([PRIMARY] as never)
    await expect(validatePublicSiteTargets(LUDO, ['site-b'])).rejects.toThrow(/inactif/)
  })

  it('accepte une liste vide pour cibler tous les lieux', async () => {
    await expect(validatePublicSiteTargets(LUDO, [])).resolves.toEqual([])
    expect(listActiveSiteRows).not.toHaveBeenCalled()
  })
})
