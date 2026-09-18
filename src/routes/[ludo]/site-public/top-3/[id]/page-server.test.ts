import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/media/blob-storage.js', () => {
  class MediaStorageError extends Error {}
  return {
    MediaStorageError,
    uploadPublicSiteMedia: vi.fn(),
    deletePublicSiteMedia: vi.fn(),
  }
})
vi.mock('$lib/server/media/media-service.js', () => {
  class MediaCompensationError extends Error {}
  return { MediaCompensationError, uploadAndRegisterMedia: vi.fn() }
})
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/services/public-top-threes.js', () => {
  class PublicTopThreeServiceError extends Error {}
  return {
    PublicTopThreeServiceError,
    authorizePublicTopThreeMediaScope: vi.fn(),
    clearPublicTopThreeGameImage: vi.fn(),
    deselectPublicTopThreeFromHomepage: vi.fn(),
    getPublicTopThree: vi.fn(),
    publishPublicTopThree: vi.fn(),
    selectPublicTopThreeForHomepage: vi.fn(),
    setPublicTopThreeGameImage: vi.fn(),
    updatePublicTopThree: vi.fn(),
  }
})

import { requireLudoContext } from '$lib/server/ludo-context.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { deletePublicSiteMedia, uploadPublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  authorizePublicTopThreeMediaScope,
  clearPublicTopThreeGameImage,
  deselectPublicTopThreeFromHomepage,
  getPublicTopThree,
  PublicTopThreeServiceError,
  publishPublicTopThree,
  selectPublicTopThreeForHomepage,
  setPublicTopThreeGameImage,
  updatePublicTopThree,
} from '$lib/server/services/public-top-threes.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const TOP_THREE_ID = '33333333-3333-4333-8333-333333333333'
const OLD_PATH = `public-site/${LUDO_ID}/top-games/${TOP_THREE_ID}/55555555-5555-4555-8555-555555555555.webp`
const NEW_PATH = `public-site/${LUDO_ID}/top-games/${TOP_THREE_ID}/66666666-6666-4666-8666-666666666666.webp`
const scope = { ludoId: LUDO_ID, domain: 'top-games', entityId: TOP_THREE_ID } as never
const topThree = {
  id: TOP_THREE_ID,
  ludoId: LUDO_ID,
  slug: 'pour-debuter',
  theme: 'Pour débuter',
  games: [{ name: 'Azul' }, { name: 'Cascadia' }, { name: 'Just One' }],
  status: 'published',
  revision: 5,
  isHomepage: false,
  targets: [],
}

function image(name: string) {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], name, { type: 'image/jpeg' })
}

function event(entries: Array<[string, string | File]>, id = TOP_THREE_ID) {
  const data = new FormData()
  for (const [name, value] of entries) data.append(name, value as never)
  return {
    params: { ludo: 'test', id },
    locals: {},
    cookies: {},
    request: new Request('http://local.test', { method: 'POST', body: data }),
  }
}

function baseFields(): Array<[string, string | File]> {
  return [
    ['id', TOP_THREE_ID],
    ['revision', '5'],
    ['theme', 'Pour débuter'],
    ['name0', 'Azul'],
    ['description0', 'Accessible et élégant.'],
    ['name1', 'Cascadia'],
    ['description1', ''],
    ['name2', 'Just One'],
    ['description2', ''],
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID, isActive: true },
  } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(getPublicTopThree).mockResolvedValue(topThree as never)
  vi.mocked(updatePublicTopThree).mockResolvedValue({ ...topThree, revision: 6 } as never)
  vi.mocked(authorizePublicTopThreeMediaScope).mockResolvedValue(scope)
  vi.mocked(uploadPublicSiteMedia).mockResolvedValue({
    pathname: NEW_PATH,
    url: 'https://blob.test/top-game.webp',
    downloadUrl: 'https://blob.test/top-game.webp?download=1',
    contentType: 'image/webp',
    size: 4,
  } as never)
  vi.mocked(setPublicTopThreeGameImage).mockResolvedValue({
    topThree: { revision: 7 },
    previousStorageKey: OLD_PATH,
  } as never)
  vi.mocked(clearPublicTopThreeGameImage).mockResolvedValue({
    topThree: { revision: 8 },
    previousStorageKey: OLD_PATH,
  } as never)
  vi.mocked(uploadAndRegisterMedia).mockImplementation(async (input) => {
    const authorized = await input.authorize()
    const blob = await input.upload(authorized)
    return input.register(authorized, blob)
  })
  vi.mocked(publishPublicTopThree).mockResolvedValue({
    topThree: { ...topThree, status: 'published', revision: 9 },
    changed: true,
    previousStatus: 'draft',
  } as never)
  vi.mocked(selectPublicTopThreeForHomepage).mockResolvedValue({
    topThree: { revision: 10, isHomepage: true },
    changed: true,
  } as never)
  vi.mocked(deselectPublicTopThreeFromHomepage).mockResolvedValue({
    topThree: { revision: 10, isHomepage: false },
    changed: true,
  } as never)
})

describe('édition d’un Top 3 public', () => {
  it('charge le Top 3 du tenant', async () => {
    await expect(load(event([]) as never)).resolves.toEqual({ topThree })
    expect(getPublicTopThree).toHaveBeenCalledWith(TOP_THREE_ID, LUDO_ID)
  })

  it('répond 404 sur un identifiant hors format avant toute lecture', async () => {
    await expect(load(event([], 'pas-un-uuid') as never)).rejects.toMatchObject({ status: 404 })
    expect(getPublicTopThree).not.toHaveBeenCalled()
  })

  it('répond 404 quand le Top 3 n’appartient pas au tenant', async () => {
    vi.mocked(getPublicTopThree).mockRejectedValue(
      new PublicTopThreeServiceError('Top 3 introuvable.'),
    )
    await expect(load(event([]) as never)).rejects.toMatchObject({ status: 404 })
  })

  it('enregistre le texte avec CAS sans toucher au slug ni au ciblage', async () => {
    await actions.update!(event(baseFields()) as never)
    expect(updatePublicTopThree).toHaveBeenCalledWith(
      TOP_THREE_ID,
      LUDO_ID,
      {
        theme: 'Pour débuter',
        games: [
          { name: 'Azul', description: 'Accessible et élégant.' },
          { name: 'Cascadia' },
          { name: 'Just One' },
        ],
      },
      MEMBER_ID,
      5,
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.updated',
        metadata: { gameCount: 3 },
      }),
    )
  })

  it('remplace une photo avec la révision issue du texte et nettoie l’ancien Blob', async () => {
    await actions.update!(event([...baseFields(), ['image1', image('cascadia.jpg')]]) as never)
    const call = vi.mocked(setPublicTopThreeGameImage).mock.calls[0]
    expect(call[3]).toBe(6)
    expect(call[4]).toBe(1)
    expect(call[7]).toBe('Boîte du jeu Cascadia')
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD_PATH)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.game_image_updated',
        metadata: { position: 2 },
      }),
    )
  })

  it('retire une photo demandée et ignore le retrait si une photo la remplace', async () => {
    await actions.update!(event([...baseFields(), ['removeImage0', 'on']]) as never)
    expect(clearPublicTopThreeGameImage).toHaveBeenCalledWith(
      LUDO_ID,
      TOP_THREE_ID,
      MEMBER_ID,
      6,
      0,
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.game_image_removed',
        metadata: { position: 1 },
      }),
    )

    vi.mocked(clearPublicTopThreeGameImage).mockClear()
    await actions.update!(
      event([...baseFields(), ['removeImage0', 'on'], ['image0', image('azul.jpg')]]) as never,
    )
    expect(clearPublicTopThreeGameImage).not.toHaveBeenCalled()
  })

  it('met en ligne une ligne héritée en brouillon au premier enregistrement', async () => {
    vi.mocked(updatePublicTopThree).mockResolvedValue({
      ...topThree,
      status: 'draft',
      revision: 6,
    } as never)
    await actions.update!(event(baseFields()) as never)
    expect(publishPublicTopThree).toHaveBeenCalledWith(TOP_THREE_ID, LUDO_ID, MEMBER_ID, 6)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.published',
        metadata: { fromStatus: 'draft', toStatus: 'published' },
      }),
    )
  })

  it('ne republie pas un Top 3 déjà en ligne', async () => {
    await actions.update!(event(baseFields()) as never)
    expect(publishPublicTopThree).not.toHaveBeenCalled()
  })

  it('bascule l’accueil selon la case, avec la révision la plus récente', async () => {
    await actions.update!(event([...baseFields(), ['isHomepage', 'true']]) as never)
    expect(selectPublicTopThreeForHomepage).toHaveBeenCalledWith(
      TOP_THREE_ID,
      LUDO_ID,
      MEMBER_ID,
      6,
    )

    vi.clearAllMocks()
    vi.mocked(requireLudoContext).mockResolvedValue({
      ludo: { id: LUDO_ID },
      member: { id: MEMBER_ID },
    } as never)
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
    vi.mocked(updatePublicTopThree).mockResolvedValue({
      ...topThree,
      isHomepage: true,
      revision: 6,
    } as never)
    vi.mocked(deselectPublicTopThreeFromHomepage).mockResolvedValue({
      topThree: { revision: 7, isHomepage: false },
      changed: true,
    } as never)
    await actions.update!(event(baseFields()) as never)
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
  })

  it('rejette une révision invalide avant toute écriture', async () => {
    const fields = baseFields().filter(([name]) => name !== 'revision')
    const result = await actions.update!(event([...fields, ['revision', 'x']]) as never)
    expect(result).toMatchObject({ status: 400 })
    expect(updatePublicTopThree).not.toHaveBeenCalled()
  })
})
