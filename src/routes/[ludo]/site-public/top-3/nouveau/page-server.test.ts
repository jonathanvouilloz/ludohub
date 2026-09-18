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
    createPublicTopThree: vi.fn(),
    authorizePublicTopThreeMediaScope: vi.fn(),
    clearPublicTopThreeGameImage: vi.fn(),
    deselectPublicTopThreeFromHomepage: vi.fn(),
    selectPublicTopThreeForHomepage: vi.fn(),
    setPublicTopThreeGameImage: vi.fn(),
  }
})

import { requireLudoContext } from '$lib/server/ludo-context.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { uploadPublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  authorizePublicTopThreeMediaScope,
  createPublicTopThree,
  selectPublicTopThreeForHomepage,
  setPublicTopThreeGameImage,
} from '$lib/server/services/public-top-threes.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const TOP_THREE_ID = '33333333-3333-4333-8333-333333333333'
const NEW_PATH = `public-site/${LUDO_ID}/top-games/${TOP_THREE_ID}/66666666-6666-4666-8666-666666666666.webp`
const scope = { ludoId: LUDO_ID, domain: 'top-games', entityId: TOP_THREE_ID } as never

function image(name: string) {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], name, { type: 'image/jpeg' })
}

function event(entries: Array<[string, string | File]>) {
  const data = new FormData()
  for (const [name, value] of entries) data.append(name, value as never)
  return {
    params: { ludo: 'test' },
    locals: {},
    cookies: {},
    request: new Request('http://local.test', { method: 'POST', body: data }),
  }
}

function baseFields(): Array<[string, string | File]> {
  return [
    ['theme', 'Pour débuter'],
    ['name0', 'Azul'],
    ['description0', 'Accessible et élégant.'],
    ['name1', 'Cascadia'],
    ['description1', ''],
    ['name2', 'Just One'],
    ['description2', 'Coopératif et immédiat.'],
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID, isActive: true },
  } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(createPublicTopThree).mockResolvedValue({
    id: TOP_THREE_ID,
    revision: 1,
    status: 'published',
    isHomepage: false,
  } as never)
  vi.mocked(authorizePublicTopThreeMediaScope).mockResolvedValue(scope)
  vi.mocked(uploadPublicSiteMedia).mockResolvedValue({
    pathname: NEW_PATH,
    url: 'https://blob.test/top-game.webp',
    downloadUrl: 'https://blob.test/top-game.webp?download=1',
    contentType: 'image/webp',
    size: 4,
  } as never)
  let revision = 1
  vi.mocked(setPublicTopThreeGameImage).mockImplementation(async () => {
    revision += 1
    return { topThree: { revision }, previousStorageKey: null } as never
  })
  vi.mocked(uploadAndRegisterMedia).mockImplementation(async (input) => {
    const authorized = await input.authorize()
    const blob = await input.upload(authorized)
    return input.register(authorized, blob)
  })
  vi.mocked(selectPublicTopThreeForHomepage).mockResolvedValue({
    topThree: { revision: 9, isHomepage: true },
    changed: true,
  } as never)
})

describe('création d’un Top 3 public', () => {
  it('exige la session et le module actif avant d’afficher le formulaire', async () => {
    await expect(load(event([]) as never)).resolves.toEqual({})
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(load(event([]) as never)).rejects.toMatchObject({ status: 404 })
  })

  it('crée un Top 3 en ligne sur tous les lieux actifs, sans slug ni ciblage saisis', async () => {
    await actions.create!(event(baseFields()) as never)
    expect(createPublicTopThree).toHaveBeenCalledWith(LUDO_ID, MEMBER_ID, {
      theme: 'Pour débuter',
      games: [
        { name: 'Azul', description: 'Accessible et élégant.' },
        { name: 'Cascadia' },
        { name: 'Just One', description: 'Coopératif et immédiat.' },
      ],
      targetMode: 'all',
      siteIds: [],
      publish: true,
    })
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.created',
        actorLudoId: LUDO_ID,
        actorMemberId: MEMBER_ID,
        entityId: TOP_THREE_ID,
        metadata: { gameCount: 3, published: true },
      }),
    )
    const metadata = vi.mocked(emitAuditEvent).mock.calls[0][0].metadata
    expect(metadata).not.toHaveProperty('theme')
    expect(metadata).not.toHaveProperty('games')
  })

  it('envoie les photos du même formulaire en propageant la révision retournée', async () => {
    await actions.create!(
      event([
        ...baseFields(),
        ['image0', image('azul.jpg')],
        ['image2', image('just-one.jpg')],
      ]) as never,
    )
    const calls = vi.mocked(setPublicTopThreeGameImage).mock.calls
    expect(calls).toHaveLength(2)
    // (ludoId, topThreeId, memberId, revision, index, scope, blob, alt)
    expect(calls[0][3]).toBe(1)
    expect(calls[0][4]).toBe(0)
    expect(calls[0][7]).toBe('Boîte du jeu Azul')
    expect(calls[1][3]).toBe(2)
    expect(calls[1][4]).toBe(2)
    expect(calls[1][7]).toBe('Boîte du jeu Just One')
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.game_image_updated',
        metadata: { position: 1, hadPreviousImage: false },
      }),
    )
  })

  it('met le Top 3 sur l’accueil avec la révision issue des photos', async () => {
    await actions.create!(
      event([...baseFields(), ['image0', image('azul.jpg')], ['isHomepage', 'true']]) as never,
    )
    expect(selectPublicTopThreeForHomepage).toHaveBeenCalledWith(
      TOP_THREE_ID,
      LUDO_ID,
      MEMBER_ID,
      2,
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.homepage_selected',
        metadata: { isHomepage: true },
      }),
    )
  })

  it('ne touche pas à l’accueil quand la case reste décochée', async () => {
    await actions.create!(event(baseFields()) as never)
    expect(selectPublicTopThreeForHomepage).not.toHaveBeenCalled()
  })

  it('renvoie une erreur de formulaire quand le service refuse la création', async () => {
    const { PublicTopThreeServiceError } = await import('$lib/server/services/public-top-threes.js')
    vi.mocked(createPublicTopThree).mockRejectedValue(
      new PublicTopThreeServiceError('La publication exige au moins un lieu actif.'),
    )
    const result = await actions.create!(event(baseFields()) as never)
    expect(result).toMatchObject({
      status: 400,
      data: { error: 'La publication exige au moins un lieu actif.' },
    })
    expect(setPublicTopThreeGameImage).not.toHaveBeenCalled()
  })
})
