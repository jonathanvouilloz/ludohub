import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/installations.js', () => ({
  getActiveInstallation: vi.fn(),
  getInstallationById: vi.fn(),
  getInstallationDetail: vi.fn(),
  createInstallation: vi.fn(),
  closeInstallation: vi.fn(),
  createCheckup: vi.fn(),
  listInstallations: vi.fn(),
  getActiveInstallationsByLudo: vi.fn(),
  applyConditions: vi.fn(),
  applyThemeItemConditions: vi.fn(),
  setInstallationItemCondition: vi.fn(),
}))
vi.mock('../db/loans.js', () => ({ getActiveLoanToLudo: vi.fn() }))
vi.mock('../db/themes.js', () => ({ getThemeById: vi.fn() }))
vi.mock('./events.js', () => ({ emitEvent: vi.fn() }))

import {
  applyThemeItemConditions,
  closeInstallation,
  createCheckup,
  createInstallation,
  getActiveInstallation,
  getActiveInstallationsByLudo,
  getInstallationById,
  getInstallationDetail,
} from '../db/installations.js'
import { getActiveLoanToLudo } from '../db/loans.js'
import { getThemeById } from '../db/themes.js'
import { emitEvent } from './events.js'
import {
  closeInstallationForLudo,
  closeInstallationWithCheckup,
  installTheme,
  listProblematicItems,
  recordCheckup,
  InstallationServiceError,
} from './installations.js'

const OWNER = 'ludo-a'
const OTHER = 'ludo-b'
const THEME = 'theme-1'
const MEMBER = 'member-1'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getThemeById).mockResolvedValue({
    id: THEME,
    name: 'Pirates',
    ownerLudoId: OWNER,
    isArchived: false,
    items: [
      { id: 'it-1', isArchived: false },
      { id: 'it-2', isArchived: false },
      { id: 'it-3', isArchived: true },
    ],
  } as never)
  vi.mocked(getActiveInstallation).mockResolvedValue(undefined as never)
  vi.mocked(getActiveLoanToLudo).mockResolvedValue(undefined as never)
  vi.mocked(createInstallation).mockResolvedValue({ id: 'inst-1' } as never)
})

describe('installTheme', () => {
  it('crée une installation avec le sous-ensemble valide (propriétaire)', async () => {
    await installTheme(THEME, OWNER, MEMBER, ['it-1', 'it-2'], ' note ')
    expect(createInstallation).toHaveBeenCalledWith(
      { themeId: THEME, ludoId: OWNER, installedByMemberId: MEMBER, notes: 'note' },
      ['it-1', 'it-2'],
    )
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'theme_installed' }))
  })

  it('ignore les items hors thème ou archivés', async () => {
    await installTheme(THEME, OWNER, MEMBER, ['it-1', 'it-3', 'inconnu'])
    expect(createInstallation).toHaveBeenCalledWith(expect.anything(), ['it-1'])
  })

  it('refuse un sous-ensemble vide', async () => {
    await expect(installTheme(THEME, OWNER, MEMBER, [])).rejects.toThrow(/au moins un item/)
    expect(createInstallation).not.toHaveBeenCalled()
  })

  it('refuse un thème archivé', async () => {
    vi.mocked(getThemeById).mockResolvedValue({
      id: THEME,
      ownerLudoId: OWNER,
      isArchived: true,
      items: [],
    } as never)
    await expect(installTheme(THEME, OWNER, MEMBER, ['it-1'])).rejects.toThrow(/archivé/)
  })

  it('refuse si une installation est déjà en cours', async () => {
    vi.mocked(getActiveInstallation).mockResolvedValue({ id: 'inst-x' } as never)
    await expect(installTheme(THEME, OWNER, MEMBER, ['it-1'])).rejects.toThrow(/déjà en cours/)
    expect(createInstallation).not.toHaveBeenCalled()
  })

  it('autorise la ludo emprunteuse d’un prêt actif', async () => {
    vi.mocked(getActiveLoanToLudo).mockResolvedValue({ id: 'loan-1' } as never)
    await installTheme(THEME, OTHER, MEMBER, ['it-1'])
    expect(createInstallation).toHaveBeenCalledWith(expect.objectContaining({ ludoId: OTHER }), [
      'it-1',
    ])
  })

  it('refuse une ludo non propriétaire sans prêt actif', async () => {
    await expect(installTheme(THEME, OTHER, MEMBER, ['it-1'])).rejects.toThrow(/autorisé/)
    expect(createInstallation).not.toHaveBeenCalled()
  })
})

describe('closeInstallationForLudo', () => {
  it('clôture une installation en cours de la ludo', async () => {
    vi.mocked(getInstallationById).mockResolvedValue({
      id: 'inst-1',
      ludoId: OWNER,
      themeId: THEME,
      status: 'en_cours',
    } as never)
    await closeInstallationForLudo('inst-1', OWNER)
    expect(closeInstallation).toHaveBeenCalledWith('inst-1')
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'installation_closed' }))
  })

  it('refuse une installation déjà clôturée', async () => {
    vi.mocked(getInstallationById).mockResolvedValue({
      id: 'inst-1',
      ludoId: OWNER,
      status: 'cloturee',
    } as never)
    await expect(closeInstallationForLudo('inst-1', OWNER)).rejects.toThrow(/déjà clôturée/)
  })

  it('refuse une installation d’une autre ludo', async () => {
    vi.mocked(getInstallationById).mockResolvedValue({
      id: 'inst-1',
      ludoId: OTHER,
      status: 'en_cours',
    } as never)
    await expect(closeInstallationForLudo('inst-1', OWNER)).rejects.toThrow(
      InstallationServiceError,
    )
  })
})

describe('recordCheckup', () => {
  beforeEach(() => {
    vi.mocked(getInstallationDetail).mockResolvedValue({
      id: 'inst-1',
      ludoId: OWNER,
      themeId: THEME,
      status: 'en_cours',
      theme: { name: 'Pirates' },
      items: [{ id: 'ii-1' }, { id: 'ii-2' }],
    } as never)
    vi.mocked(createCheckup).mockResolvedValue({ id: 'chk-1' } as never)
  })

  it('enregistre un check-up tout présent (pas de notif manquant)', async () => {
    await recordCheckup('inst-1', OWNER, MEMBER, [
      { installationItemId: 'ii-1', status: 'present' },
      { installationItemId: 'ii-2', status: 'present' },
    ])
    expect(createCheckup).toHaveBeenCalled()
    const types = vi.mocked(emitEvent).mock.calls.map((c) => c[0].type)
    expect(types).toContain('checkup_recorded')
    expect(types).not.toContain('checkup_missing_item')
  })

  it('notifie les responsables quand un item est manquant', async () => {
    await recordCheckup('inst-1', OWNER, MEMBER, [
      { installationItemId: 'ii-1', status: 'present' },
      { installationItemId: 'ii-2', status: 'manquant' },
    ])
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'checkup_missing_item', recipientResponsablesOf: OWNER }),
    )
  })

  it('ignore les items hors installation', async () => {
    await recordCheckup('inst-1', OWNER, MEMBER, [
      { installationItemId: 'ii-1', status: 'present' },
      { installationItemId: 'hors', status: 'manquant' },
    ])
    const [, , statuses] = vi.mocked(createCheckup).mock.calls[0]
    expect(statuses).toEqual([{ installationItemId: 'ii-1', status: 'present' }])
  })

  it('refuse un check-up sur une installation clôturée', async () => {
    vi.mocked(getInstallationDetail).mockResolvedValue({
      id: 'inst-1',
      ludoId: OWNER,
      status: 'cloturee',
      theme: { name: 'Pirates' },
      items: [{ id: 'ii-1' }],
    } as never)
    await expect(
      recordCheckup('inst-1', OWNER, MEMBER, [{ installationItemId: 'ii-1', status: 'present' }]),
    ).rejects.toThrow(/clôturée/)
  })

  it('refuse une installation d’une autre ludo', async () => {
    await expect(
      recordCheckup('inst-1', OTHER, MEMBER, [{ installationItemId: 'ii-1', status: 'present' }]),
    ).rejects.toThrow(InstallationServiceError)
  })
})

describe('listProblematicItems', () => {
  it('ne remonte que les objets à réparer / manquants, groupables par thème', async () => {
    vi.mocked(getActiveInstallationsByLudo).mockResolvedValue([
      {
        id: 'inst-1',
        theme: { id: THEME, name: 'Pirates' },
        items: [
          { condition: 'present', themeItem: { name: 'Longue-vue' } },
          { condition: 'a_reparer', themeItem: { name: 'Coffre' } },
          { condition: 'manquant', themeItem: { name: 'Drapeau' } },
        ],
        checkups: [{ checkedAt: new Date('2026-06-20T10:00:00Z') }],
      },
    ] as never)

    const result = await listProblematicItems(OWNER)

    expect(result).toEqual([
      {
        themeId: THEME,
        themeName: 'Pirates',
        installationId: 'inst-1',
        itemName: 'Coffre',
        condition: 'a_reparer',
        lastCheckupAt: new Date('2026-06-20T10:00:00Z'),
      },
      {
        themeId: THEME,
        themeName: 'Pirates',
        installationId: 'inst-1',
        itemName: 'Drapeau',
        condition: 'manquant',
        lastCheckupAt: new Date('2026-06-20T10:00:00Z'),
      },
    ])
  })

  it('renvoie une liste vide quand tout est présent (et gère l’absence de check-up)', async () => {
    vi.mocked(getActiveInstallationsByLudo).mockResolvedValue([
      {
        id: 'inst-1',
        theme: { id: THEME, name: 'Pirates' },
        items: [{ condition: 'present', themeItem: { name: 'Longue-vue' } }],
        checkups: [],
      },
    ] as never)

    expect(await listProblematicItems(OWNER)).toEqual([])
  })
})

describe('closeInstallationWithCheckup', () => {
  beforeEach(() => {
    vi.mocked(getInstallationDetail).mockResolvedValue({
      id: 'inst-1',
      ludoId: OWNER,
      themeId: THEME,
      status: 'en_cours',
      theme: { name: 'Pirates' },
      items: [
        { id: 'ii-1', themeItemId: 'it-1' },
        { id: 'ii-2', themeItemId: 'it-2' },
      ],
    } as never)
    vi.mocked(createCheckup).mockResolvedValue({ id: 'chk-final' } as never)
  })

  it('reporte l’état final sur les theme_items puis clôture', async () => {
    await closeInstallationWithCheckup('inst-1', OWNER, MEMBER, [
      { installationItemId: 'ii-1', status: 'present' },
      { installationItemId: 'ii-2', status: 'manquant' },
    ])
    expect(applyThemeItemConditions).toHaveBeenCalledWith([
      { themeItemId: 'it-1', condition: 'present' },
      { themeItemId: 'it-2', condition: 'manquant' },
    ])
    expect(closeInstallation).toHaveBeenCalledWith('inst-1')
    const types = vi.mocked(emitEvent).mock.calls.map((c) => c[0].type)
    expect(types).toContain('checkup_recorded')
    expect(types).toContain('checkup_missing_item')
    expect(types).toContain('installation_closed')
  })

  it('ne notifie pas de manquant quand tout est présent', async () => {
    await closeInstallationWithCheckup('inst-1', OWNER, MEMBER, [
      { installationItemId: 'ii-1', status: 'present' },
      { installationItemId: 'ii-2', status: 'present' },
    ])
    const types = vi.mocked(emitEvent).mock.calls.map((c) => c[0].type)
    expect(types).toContain('installation_closed')
    expect(types).not.toContain('checkup_missing_item')
  })

  it('refuse une installation déjà clôturée', async () => {
    vi.mocked(getInstallationDetail).mockResolvedValue({
      id: 'inst-1',
      ludoId: OWNER,
      status: 'cloturee',
      theme: { name: 'Pirates' },
      items: [{ id: 'ii-1', themeItemId: 'it-1' }],
    } as never)
    await expect(
      closeInstallationWithCheckup('inst-1', OWNER, MEMBER, [
        { installationItemId: 'ii-1', status: 'present' },
      ]),
    ).rejects.toThrow(/déjà clôturée/)
    expect(closeInstallation).not.toHaveBeenCalled()
  })
})
