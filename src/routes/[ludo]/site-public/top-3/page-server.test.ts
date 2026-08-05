import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/db/sites.js', () => ({ listSiteRowsWithOpeningHours: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/services/public-top-threes.js', () => {
  class PublicTopThreeServiceError extends Error {}
  return {
    PublicTopThreeServiceError,
    listPublicTopThreesForManagement: vi.fn(),
    createPublicTopThree: vi.fn(),
    selectPublicTopThreeForHomepage: vi.fn(),
    deselectPublicTopThreeFromHomepage: vi.fn(),
    updatePublicTopThree: vi.fn(),
    publishPublicTopThree: vi.fn(),
    hidePublicTopThree: vi.fn(),
    deleteDraftPublicTopThree: vi.fn(),
  }
})

import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  createPublicTopThree,
  deselectPublicTopThreeFromHomepage,
  deleteDraftPublicTopThree,
  hidePublicTopThree,
  listPublicTopThreesForManagement,
  publishPublicTopThree,
  selectPublicTopThreeForHomepage,
  updatePublicTopThree,
} from '$lib/server/services/public-top-threes.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const TOP_THREE_ID = '33333333-3333-4333-8333-333333333333'
const SITE_ID = '44444444-4444-4444-8444-444444444444'
const games = [
  { name: 'Azul', description: 'Accessible et élégant.' },
  { name: 'Cascadia', description: 'Paisible et tactique.' },
  { name: 'Just One', description: 'Coopératif et immédiat.' },
]
const topThree = {
  id: TOP_THREE_ID,
  ludoId: LUDO_ID,
  slug: 'pour-debuter',
  theme: 'Pour débuter',
  games,
  status: 'draft',
  revision: 1,
  publishedAt: null,
  isHomepage: false,
  targets: [],
}

function event(fields: Array<[string, string]> = []) {
  const data = new FormData()
  for (const [name, value] of fields) data.append(name, value)
  return {
    params: { ludo: 'test' },
    locals: {},
    cookies: {},
    request: new Request('http://local.test', { method: 'POST', body: data }),
  }
}

function fields(extra: Array<[string, string]> = []): Array<[string, string]> {
  return [
    ['slug', 'pour-debuter'],
    ['theme', 'Pour débuter'],
    ['games', JSON.stringify(games)],
    ...extra,
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID, isActive: true },
  } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicTopThreesForManagement).mockResolvedValue([topThree] as never)
  vi.mocked(listSiteRowsWithOpeningHours).mockResolvedValue([
    { id: SITE_ID, isActive: true },
  ] as never)
  vi.mocked(createPublicTopThree).mockResolvedValue(topThree as never)
  vi.mocked(updatePublicTopThree).mockResolvedValue(topThree as never)
  vi.mocked(publishPublicTopThree).mockResolvedValue({
    topThree: { ...topThree, status: 'published', revision: 2 },
    changed: true,
    previousStatus: 'draft',
  } as never)
  vi.mocked(hidePublicTopThree).mockResolvedValue({
    topThree: { ...topThree, status: 'hidden', revision: 2 },
    changed: true,
    previousStatus: 'published',
  } as never)
  vi.mocked(selectPublicTopThreeForHomepage).mockResolvedValue({
    topThree: { ...topThree, status: 'published', revision: 2, isHomepage: true },
    changed: true,
  } as never)
  vi.mocked(deselectPublicTopThreeFromHomepage).mockResolvedValue({
    topThree: { ...topThree, status: 'published', revision: 2, isHomepage: false },
    changed: true,
  } as never)
})

describe('gestion des Top 3 publics', () => {
  it('exige la session puis charge les contenus et lieux du tenant', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({ topThrees: [topThree] })
    expect(requireLudoContext).toHaveBeenCalledOnce()
    expect(listPublicTopThreesForManagement).toHaveBeenCalledWith(LUDO_ID)
    expect(listSiteRowsWithOpeningHours).toHaveBeenCalledWith(LUDO_ID)
  })

  it('répond 404 avant les lectures métier si le module est désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(load(event() as never)).rejects.toMatchObject({ status: 404 })
    expect(listPublicTopThreesForManagement).not.toHaveBeenCalled()
  })

  it('propage le refus de session avant toute vérification ou lecture tenant', async () => {
    vi.mocked(requireLudoContext).mockRejectedValue({ status: 401, message: 'Non authentifié' })
    await expect(load(event() as never)).rejects.toMatchObject({ status: 401 })
    expect(isPublicSiteEnabled).not.toHaveBeenCalled()
    expect(listPublicTopThreesForManagement).not.toHaveBeenCalled()
  })

  it('crée exactement trois jeux directs avec auteur et ciblage tenant-scopés', async () => {
    await actions.create!(
      event(
        fields([
          ['targetMode', 'explicit'],
          ['siteIds', SITE_ID],
        ]),
      ) as never,
    )
    expect(createPublicTopThree).toHaveBeenCalledWith(LUDO_ID, MEMBER_ID, {
      slug: 'pour-debuter',
      theme: 'Pour débuter',
      games,
      targetMode: 'explicit',
      siteIds: [SITE_ID],
    })
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.created',
        actorLudoId: LUDO_ID,
        actorMemberId: MEMBER_ID,
        entityId: TOP_THREE_ID,
        metadata: { targetMode: 'explicit', targetSiteIds: [SITE_ID], gameCount: 3 },
      }),
    )
    const metadata = vi.mocked(emitAuditEvent).mock.calls[0][0].metadata
    expect(metadata).not.toHaveProperty('theme')
    expect(metadata).not.toHaveProperty('games')
  })

  it('rejette un JSON de jeux invalide avant le service', async () => {
    const result = await actions.create!(
      event([
        ['slug', 'x'],
        ['theme', 'X'],
        ['games', '{'],
        ['targetMode', 'all'],
      ]) as never,
    )
    expect(result).toMatchObject({ status: 400 })
    expect(createPublicTopThree).not.toHaveBeenCalled()
  })

  it('rejette un ciblage explicite vide avant le service', async () => {
    const result = await actions.create!(event(fields([['targetMode', 'explicit']])) as never)
    expect(result).toMatchObject({ status: 400 })
    expect(createPublicTopThree).not.toHaveBeenCalled()
  })

  it('met à jour avec révision CAS et conserve le slug publié absent du formulaire', async () => {
    const updateFields = fields([
      ['id', TOP_THREE_ID],
      ['revision', '7'],
      ['targetMode', 'all'],
    ]).filter(([name]) => name !== 'slug')
    await actions.update!(event(updateFields) as never)
    expect(updatePublicTopThree).toHaveBeenCalledWith(
      TOP_THREE_ID,
      LUDO_ID,
      { theme: 'Pour débuter', games, slug: undefined, targetMode: 'all', siteIds: [] },
      MEMBER_ID,
      7,
    )
  })

  it('publie et audite uniquement une transition effective', async () => {
    await actions.publication!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '1'],
        ['status', 'published'],
      ]) as never,
    )
    expect(publishPublicTopThree).toHaveBeenCalledWith(TOP_THREE_ID, LUDO_ID, MEMBER_ID, 1)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_top_three.published' }),
    )

    vi.clearAllMocks()
    vi.mocked(requireLudoContext).mockResolvedValue({
      ludo: { id: LUDO_ID },
      member: { id: MEMBER_ID },
    } as never)
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
    vi.mocked(publishPublicTopThree).mockResolvedValue({
      topThree: { ...topThree, status: 'published' },
      changed: false,
      previousStatus: 'published',
    } as never)
    await actions.publication!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '2'],
        ['status', 'published'],
      ]) as never,
    )
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('masque avec la même portée tenant, acteur et révision', async () => {
    await actions.publication!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '3'],
        ['status', 'hidden'],
      ]) as never,
    )
    expect(hidePublicTopThree).toHaveBeenCalledWith(TOP_THREE_ID, LUDO_ID, MEMBER_ID, 3)
  })

  it('sélectionne un Top 3 publié pour l’accueil avec CAS et audit minimal', async () => {
    await actions.homepage!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '5'],
        ['isHomepage', 'true'],
      ]) as never,
    )
    expect(selectPublicTopThreeForHomepage).toHaveBeenCalledWith(
      TOP_THREE_ID,
      LUDO_ID,
      MEMBER_ID,
      5,
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.homepage_selected',
        entityType: 'public_top_three',
        entityId: TOP_THREE_ID,
        metadata: { isHomepage: true },
      }),
    )
    expect(vi.mocked(emitAuditEvent).mock.calls[0][0].metadata).not.toHaveProperty('games')
    expect(vi.mocked(emitAuditEvent).mock.calls[0][0].metadata).not.toHaveProperty('theme')
  })

  it('désélectionne avec CAS et n’audite pas une opération idempotente', async () => {
    await actions.homepage!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '6'],
        ['isHomepage', 'false'],
      ]) as never,
    )
    expect(deselectPublicTopThreeFromHomepage).toHaveBeenCalledWith(
      TOP_THREE_ID,
      LUDO_ID,
      MEMBER_ID,
      6,
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.homepage_deselected',
        metadata: { isHomepage: false },
      }),
    )

    vi.clearAllMocks()
    vi.mocked(requireLudoContext).mockResolvedValue({
      ludo: { id: LUDO_ID },
      member: { id: MEMBER_ID },
    } as never)
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
    vi.mocked(deselectPublicTopThreeFromHomepage).mockResolvedValue({
      topThree: { ...topThree, status: 'published', isHomepage: false },
      changed: false,
    } as never)
    await actions.homepage!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '7'],
        ['isHomepage', 'false'],
      ]) as never,
    )
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('rejette une intention d’accueil invalide avant le service', async () => {
    const result = await actions.homepage!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '1'],
        ['isHomepage', 'yes'],
      ]) as never,
    )
    expect(result).toMatchObject({ status: 400 })
    expect(selectPublicTopThreeForHomepage).not.toHaveBeenCalled()
    expect(deselectPublicTopThreeFromHomepage).not.toHaveBeenCalled()
  })

  it('supprime uniquement via le service de brouillons avec CAS et audit', async () => {
    await actions.delete!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '4'],
      ]) as never,
    )
    expect(deleteDraftPublicTopThree).toHaveBeenCalledWith(TOP_THREE_ID, LUDO_ID, 4)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_top_three.deleted', entityId: TOP_THREE_ID }),
    )
  })
})
