import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/db/sites.js', () => ({ listSiteRowsWithOpeningHours: vi.fn() }))
vi.mock('$lib/server/db/members.js', () => ({ getActiveMembersByLudo: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/media/blob-storage.js', () => {
  class MediaStorageError extends Error {}
  return { MediaStorageError, uploadPublicSiteMedia: vi.fn(), deletePublicSiteMedia: vi.fn() }
})
vi.mock('$lib/server/media/media-service.js', () => {
  class MediaCompensationError extends Error {}
  return { MediaCompensationError, uploadAndRegisterMedia: vi.fn() }
})
vi.mock('$lib/server/services/public-profiles.js', () => {
  class PublicProfileServiceError extends Error {}
  return {
    PublicProfileServiceError,
    listPublicProfilesForManagement: vi.fn(),
    createPublicProfile: vi.fn(),
    updatePublicProfile: vi.fn(),
    publishPublicProfile: vi.fn(),
    hidePublicProfile: vi.fn(),
    deleteDraftPublicProfile: vi.fn(),
    authorizePublicProfileMediaScope: vi.fn(),
    setPublicProfilePhoto: vi.fn(),
    clearPublicProfilePhoto: vi.fn(),
  }
})
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { getActiveMembersByLudo } from '$lib/server/db/members.js'
import { uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import { deletePublicSiteMedia, uploadPublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  authorizePublicProfileMediaScope,
  createPublicProfile,
  deleteDraftPublicProfile,
  listPublicProfilesForManagement,
  setPublicProfilePhoto,
} from '$lib/server/services/public-profiles.js'
import { actions, load } from './+page.server.js'
const L = '11111111-1111-4111-8111-111111111111',
  M = '22222222-2222-4222-8222-222222222222',
  ID = '33333333-3333-4333-8333-333333333333',
  LINK = '44444444-4444-4444-8444-444444444444',
  OLD = `public-site/${L}/profiles/${ID}/old.jpg`,
  NEW = `public-site/${L}/profiles/${ID}/new.jpg`,
  scope = { ludoId: L, domain: 'profiles', entityId: ID } as never,
  p = {
    id: ID,
    revision: 1,
    memberId: LINK,
    section: 'team',
    displayName: 'Alice',
    roleTitle: 'Présidente',
    bioMarkdown: 'Bio',
    sortOrder: 1,
    status: 'draft',
    photoUrl: null,
    photoStorageKey: OLD,
    photoAlt: null,
    targets: [],
  }
function event(fields: Array<[string, FormDataEntryValue]> = []) {
  const d = new FormData()
  for (const [k, v] of fields) d.append(k, v)
  return {
    params: { ludo: 'x' },
    locals: {},
    cookies: {},
    request: new Request('http://x', { method: 'POST', body: d }),
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L }, member: { id: M } } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicProfilesForManagement).mockResolvedValue([p] as never)
  vi.mocked(getActiveMembersByLudo).mockResolvedValue([{ id: LINK, name: 'Membre Alice' }] as never)
  vi.mocked(createPublicProfile).mockResolvedValue(p as never)
  vi.mocked(authorizePublicProfileMediaScope).mockResolvedValue(scope)
  vi.mocked(uploadPublicSiteMedia).mockResolvedValue({
    pathname: NEW,
    url: 'https://x',
    downloadUrl: 'https://x',
    contentType: 'image/jpeg',
    size: 3,
  } as never)
  vi.mocked(setPublicProfilePhoto).mockResolvedValue({
    profile: p,
    previousStorageKey: OLD,
  } as never)
  vi.mocked(deleteDraftPublicProfile).mockResolvedValue({ previousStorageKey: OLD } as never)
  vi.mocked(uploadAndRegisterMedia).mockImplementation(async (x) => {
    const s = await x.authorize(),
      b = await x.upload(s)
    try {
      return await x.register(s, b)
    } catch (e) {
      await x.cleanup(s, b.pathname)
      throw e
    }
  })
})
describe('route profils', () => {
  it('charge profils, sites et seulement membres actifs du tenant', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({
      profiles: [p],
      members: [{ id: LINK, displayName: 'Membre Alice' }],
    })
    expect(getActiveMembersByLudo).toHaveBeenCalledWith(L)
  })
  it('crée un profil lié sans exposer memberId dans audit', async () => {
    await actions.create!(
      event([
        ['memberId', LINK],
        ['section', 'team'],
        ['displayName', 'Alice'],
        ['roleTitle', 'Présidente'],
        ['bioMarkdown', 'Bio'],
        ['sortOrder', '1'],
        ['targetMode', 'all'],
      ]) as never,
    )
    expect(createPublicProfile).toHaveBeenCalledWith(L, M, {
      memberId: LINK,
      section: 'team',
      displayName: 'Alice',
      roleTitle: 'Présidente',
      bioMarkdown: 'Bio',
      sortOrder: 1,
      targetMode: 'all',
      siteIds: [],
    })
    expect(vi.mocked(createPublicProfile).mock.calls[0][2].memberId).toBe(LINK)
  })
  it('upload photo sécurisé 5 MiB avec alt', async () => {
    const f = new File(['jpg'], 'a.jpg', { type: 'image/jpeg' })
    await actions.uploadPhoto!(
      event([
        ['id', ID],
        ['revision', '1'],
        ['alt', 'Portrait Alice'],
        ['file', f],
      ]) as never,
    )
    expect(setPublicProfilePhoto).toHaveBeenCalledWith(
      L,
      ID,
      M,
      1,
      scope,
      expect.objectContaining({ pathname: NEW }),
      'Portrait Alice',
    )
    expect(uploadPublicSiteMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: {
          maxBytes: 5 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
      }),
    )
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD)
  })
  it('rejette photo sans alt', async () => {
    const f = new File(['jpg'], 'a.jpg', { type: 'image/jpeg' })
    const result = await actions.uploadPhoto!(
      event([
        ['id', ID],
        ['revision', '1'],
        ['file', f],
      ]) as never,
    )
    expect(result).toMatchObject({ status: 400 })
    expect(uploadPublicSiteMedia).not.toHaveBeenCalled()
  })
  it('supprime brouillon et nettoie photo', async () => {
    await actions.delete!(
      event([
        ['id', ID],
        ['revision', '1'],
      ]) as never,
    )
    expect(deleteDraftPublicProfile).toHaveBeenCalledWith(ID, L, 1)
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD)
  })
})
