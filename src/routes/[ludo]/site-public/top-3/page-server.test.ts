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
    listPublicTopThreesForManagement: vi.fn(),
    authorizePublicTopThreeMediaScope: vi.fn(),
    clearPublicTopThreeGameImage: vi.fn(),
    deselectPublicTopThreeFromHomepage: vi.fn(),
    getPublicTopThree: vi.fn(),
    permanentlyDeletePublicTopThree: vi.fn(),
    selectPublicTopThreeForHomepage: vi.fn(),
    setPublicTopThreeGameImage: vi.fn(),
  }
})

import { requireLudoContext } from '$lib/server/ludo-context.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { deletePublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  authorizePublicTopThreeMediaScope,
  getPublicTopThree,
  listPublicTopThreesForManagement,
  permanentlyDeletePublicTopThree,
} from '$lib/server/services/public-top-threes.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const TOP_THREE_ID = '33333333-3333-4333-8333-333333333333'
const IMAGE_PATH = `public-site/${LUDO_ID}/top-games/${TOP_THREE_ID}/55555555-5555-4555-8555-555555555555.webp`
const scope = { ludoId: LUDO_ID, domain: 'top-games', entityId: TOP_THREE_ID } as never
const topThree = {
  id: TOP_THREE_ID,
  ludoId: LUDO_ID,
  slug: 'pour-debuter',
  theme: 'Pour débuter',
  games: [
    { name: 'Azul', description: 'Accessible.', imageStorageKey: IMAGE_PATH },
    { name: 'Cascadia' },
    { name: 'Just One' },
  ],
  status: 'published',
  revision: 4,
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID, isActive: true },
  } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicTopThreesForManagement).mockResolvedValue([topThree] as never)
  vi.mocked(getPublicTopThree).mockResolvedValue(topThree as never)
  vi.mocked(authorizePublicTopThreeMediaScope).mockResolvedValue(scope)
})

describe('liste des Top 3 publics', () => {
  it('exige la session puis ne charge que les Top 3 du tenant', async () => {
    await expect(load(event() as never)).resolves.toEqual({ topThrees: [topThree] })
    expect(requireLudoContext).toHaveBeenCalledOnce()
    expect(listPublicTopThreesForManagement).toHaveBeenCalledWith(LUDO_ID)
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

  it('supprime avec CAS, nettoie les images et audite sans le contenu', async () => {
    await actions.delete!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '4'],
      ]) as never,
    )
    expect(permanentlyDeletePublicTopThree).toHaveBeenCalledWith(TOP_THREE_ID, LUDO_ID, 4)
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, IMAGE_PATH)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_top_three.deleted',
        entityType: 'public_top_three',
        entityId: TOP_THREE_ID,
      }),
    )
    expect(vi.mocked(emitAuditEvent).mock.calls[0][0].metadata).toBeUndefined()
  })

  it('rejette une révision invalide avant toute suppression', async () => {
    const result = await actions.delete!(
      event([
        ['id', TOP_THREE_ID],
        ['revision', '0'],
      ]) as never,
    )
    expect(result).toMatchObject({ status: 400 })
    expect(permanentlyDeletePublicTopThree).not.toHaveBeenCalled()
  })
})
