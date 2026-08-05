import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  get: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  pub: vi.fn(),
  photo: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  visible: vi.fn(),
  sites: vi.fn(),
  enabled: vi.fn(),
  resolve: vi.fn(),
  ensure: vi.fn(),
}))
vi.mock('../db/public-profiles.js', () => ({
  getPublicProfileRowForLudo: m.get,
  insertPublicProfileAtomic: m.insert,
  updatePublicProfileAtomic: m.update,
  updatePublicProfilePublicationRow: m.pub,
  updatePublicProfilePhotoRow: m.photo,
  deleteDraftPublicProfileRow: m.remove,
  listPublicProfileRows: m.list,
  listVisiblePublicProfileRows: m.visible,
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: m.sites }))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled: m.enabled }))
vi.mock('./public-faqs.js', () => {
  class PublicFaqServiceError extends Error {}
  return {
    PublicFaqServiceError,
    resolvePublicEditorialTargets: m.resolve,
    ensurePublicEditorialTargets: m.ensure,
    validatePublicEditorialText: (v: string) => {
      if (!v.trim()) throw new PublicFaqServiceError('vide')
      return v.trim()
    },
    validatePublicEditorialMarkdown: (v: string) => {
      if (/[<>]/.test(v)) throw new PublicFaqServiceError('HTML')
      return v.trim()
    },
    validatePublicSortOrder: (v: number) => v,
  }
})
import { createAuthorizedMediaScope, publicSiteMediaPath } from '../media/paths.js'
import {
  clearPublicProfilePhoto,
  createPublicProfile,
  deleteDraftPublicProfile,
  listVisiblePublicProfiles,
  publishPublicProfile,
  PublicProfileServiceError,
  setPublicProfilePhoto,
  updatePublicProfile,
} from './public-profiles.js'
const L = '00000000-0000-4000-8000-000000000001',
  P = '00000000-0000-4000-8000-000000000002',
  M = '00000000-0000-4000-8000-000000000003'
const row = (x: Record<string, unknown> = {}) => ({
  id: P,
  ludoId: L,
  memberId: null,
  section: 'team',
  displayName: 'Ada',
  roleTitle: null,
  bioMarkdown: null,
  sortOrder: 0,
  photoUrl: null,
  photoStorageKey: null,
  photoAlt: null,
  status: 'draft',
  revision: 1,
  publishedAt: null,
  publishedByMemberId: null,
  targets: [],
  ...x,
})
beforeEach(() => {
  vi.clearAllMocks()
  m.get.mockResolvedValue(row())
  m.insert.mockResolvedValue(row())
  m.update.mockResolvedValue(row({ revision: 2 }))
  m.pub.mockResolvedValue(row({ revision: 2 }))
  m.photo.mockResolvedValue(row({ revision: 2 }))
  m.remove.mockResolvedValue({ id: P, photoStorageKey: null })
  m.visible.mockResolvedValue([])
  m.enabled.mockResolvedValue(true)
  m.sites.mockResolvedValue([{ id: 's', ludoId: L }])
  m.resolve.mockImplementation(async (_l, mode, s, p) => (mode === undefined ? (p ?? []) : s))
  m.ensure.mockResolvedValue(undefined)
})
describe('profils', () => {
  it('crée sans copier de donnée membre', async () => {
    await createPublicProfile(L, M, {
      memberId: M,
      section: 'team',
      displayName: ' Ada ',
      sortOrder: 1,
      targetMode: 'all',
      siteIds: [],
    })
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: M, displayName: 'Ada', photoStorageKey: null }),
      [],
    )
  })
  it('sécurise bio et section', async () => {
    await expect(
      createPublicProfile(L, M, {
        section: 'committee',
        displayName: 'Ada',
        bioMarkdown: '<b>x</b>',
        sortOrder: 1,
        targetMode: 'all',
        siteIds: [],
      }),
    ).rejects.toBeInstanceOf(PublicProfileServiceError)
    await expect(
      createPublicProfile(L, M, {
        section: 'bad' as never,
        displayName: 'Ada',
        sortOrder: 1,
        targetMode: 'all',
        siteIds: [],
      }),
    ).rejects.toThrow(/Section/)
  })
  it('publication photo optionnelle mais lieu obligatoire', async () => {
    await expect(publishPublicProfile(P, L, M, 1)).resolves.toEqual(
      expect.objectContaining({ changed: true }),
    )
    m.ensure.mockRejectedValue(
      new (await import('./public-faqs.js')).PublicFaqServiceError('aucun lieu'),
    )
    await expect(publishPublicProfile(P, L, M, 1)).rejects.toBeInstanceOf(PublicProfileServiceError)
  })
  it('CAS update', async () => {
    m.update.mockResolvedValue(undefined)
    await expect(updatePublicProfile(P, L, { displayName: 'X' }, M, 1)).rejects.toThrow(/Rechargez/)
  })
  it('photo scope profiles et limite 5MiB', async () => {
    const s = createAuthorizedMediaScope({ ludoId: L, domain: 'profiles', entityId: P }),
      path = publicSiteMediaPath({ scope: s, mediaType: 'image/png' })
    m.get
      .mockResolvedValueOnce(row({ photoStorageKey: 'old' }))
      .mockResolvedValueOnce(row({ revision: 2 }))
    await expect(
      setPublicProfilePhoto(
        L,
        P,
        M,
        1,
        s,
        {
          url: 'https://x',
          downloadUrl: 'https://x',
          pathname: path,
          contentType: 'image/png',
          size: 5 * 1024 * 1024,
        },
        'Ada',
      ),
    ).resolves.toEqual({ profile: expect.anything(), previousStorageKey: 'old' })
    await expect(
      setPublicProfilePhoto(
        L,
        P,
        M,
        1,
        s,
        {
          url: 'x',
          downloadUrl: 'x',
          pathname: path,
          contentType: 'image/png',
          size: 5 * 1024 * 1024 + 1,
        },
        'Ada',
      ),
    ).rejects.toThrow(/5 MiB/)
  })
  it('clear/delete cleanup et liste bornée/filtrée', async () => {
    m.get
      .mockResolvedValueOnce(row({ photoStorageKey: 'old' }))
      .mockResolvedValueOnce(row({ revision: 2 }))
    await expect(clearPublicProfilePhoto(L, P, M, 1)).resolves.toEqual({
      profile: expect.anything(),
      previousStorageKey: 'old',
    })
    m.get.mockResolvedValue(row())
    m.remove.mockResolvedValue({ id: P, photoStorageKey: 'old' })
    await expect(deleteDraftPublicProfile(P, L, 1)).resolves.toEqual({ previousStorageKey: 'old' })
    await listVisiblePublicProfiles(L, 'team', undefined, 999)
    expect(m.visible).toHaveBeenCalledWith(L, 'team', undefined, 200)
  })
})
