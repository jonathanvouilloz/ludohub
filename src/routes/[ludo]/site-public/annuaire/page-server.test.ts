import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/services/public-directory.js', () => {
  class PublicDirectoryServiceError extends Error {}
  return {
    PublicDirectoryServiceError,
    listPublicDirectoryForManagement: vi.fn(),
    createPublicDirectoryEntry: vi.fn(),
    deleteDraftPublicDirectoryEntry: vi.fn(),
    updatePublicDirectoryEntry: vi.fn(),
    publishPublicDirectoryEntry: vi.fn(),
    hidePublicDirectoryEntry: vi.fn(),
  }
})
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  createPublicDirectoryEntry,
  deleteDraftPublicDirectoryEntry,
  hidePublicDirectoryEntry,
  listPublicDirectoryForManagement,
  publishPublicDirectoryEntry,
  PublicDirectoryServiceError,
  updatePublicDirectoryEntry,
} from '$lib/server/services/public-directory.js'
import { actions, load } from './+page.server.js'
const L = '11111111-1111-4111-8111-111111111111',
  M = '22222222-2222-4222-8222-222222222222',
  ID = '33333333-3333-4333-8333-333333333333',
  entry = {
    id: ID,
    slug: 'ludo',
    name: 'Ludothèque',
    sortOrder: 2,
    status: 'draft',
    revision: 1,
    publishedAt: null,
  }
function event(fields: Array<[string, string]> = []) {
  const d = new FormData()
  for (const [k, v] of fields) d.append(k, v)
  return {
    params: { ludo: 'x' },
    locals: {},
    cookies: {},
    request: new Request('http://x', { method: 'POST', body: d }),
  }
}
function fields(extra: Array<[string, string]> = []): Array<[string, string]> {
  return [
    ['slug', 'ludo'],
    ['name', 'Ludothèque'],
    ['descriptionMarkdown', 'Présentation'],
    ['address', 'Rue 1'],
    ['postalCode', '1201'],
    ['city', 'Genève'],
    ['phone', '022'],
    ['email', 'a@b.ch'],
    ['website', 'https://ludo.ch'],
    ['directionsUrl', 'https://maps.example/ludo'],
    ['officialUrl', 'https://geneve.ch/ludo'],
    ['sortOrder', '2'],
    ...extra,
  ]
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L }, member: { id: M } } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicDirectoryForManagement).mockResolvedValue([entry] as never)
  vi.mocked(createPublicDirectoryEntry).mockResolvedValue(entry as never)
  vi.mocked(updatePublicDirectoryEntry).mockResolvedValue(entry as never)
  vi.mocked(publishPublicDirectoryEntry).mockResolvedValue({
    entry: { ...entry, status: 'published' },
    changed: true,
    previousStatus: 'draft',
  } as never)
  vi.mocked(hidePublicDirectoryEntry).mockResolvedValue({
    entry: { ...entry, status: 'hidden' },
    changed: true,
    previousStatus: 'published',
  } as never)
})
describe('route annuaire', () => {
  it('charge le tenant après session/module', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({ entries: [entry] })
    expect(listPublicDirectoryForManagement).toHaveBeenCalledWith(L)
  })
  it('bloque module désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(load(event() as never)).rejects.toMatchObject({ status: 404 })
  })
  it('crée avec les deux URL distinctes', async () => {
    await actions.create!(event(fields()) as never)
    expect(createPublicDirectoryEntry).toHaveBeenCalledWith(
      L,
      M,
      expect.objectContaining({
        directionsUrl: 'https://maps.example/ludo',
        officialUrl: 'https://geneve.ch/ludo',
        sortOrder: 2,
      }),
    )
    const meta = vi.mocked(emitAuditEvent).mock.calls[0][0].metadata
    expect(meta).not.toHaveProperty('email')
    expect(meta).not.toHaveProperty('phone')
  })
  it('met à jour sans slug publié avec CAS', async () => {
    const x = fields([
      ['id', ID],
      ['revision', '4'],
    ]).filter(([k]) => k !== 'slug')
    await actions.update!(event(x) as never)
    expect(updatePublicDirectoryEntry).toHaveBeenCalledWith(
      ID,
      L,
      expect.objectContaining({ slug: undefined }),
      M,
      4,
    )
  })
  it('publie tenant-scopé', async () => {
    await actions.publication!(
      event([
        ['id', ID],
        ['revision', '2'],
        ['status', 'published'],
      ]) as never,
    )
    expect(publishPublicDirectoryEntry).toHaveBeenCalledWith(ID, L, M, 2)
  })
  it('masque tenant-scopé', async () => {
    await actions.publication!(
      event([
        ['id', ID],
        ['revision', '3'],
        ['status', 'hidden'],
      ]) as never,
    )
    expect(hidePublicDirectoryEntry).toHaveBeenCalledWith(ID, L, M, 3)
  })
  it('supprime un brouillon avec tenant, CAS et audit minimal', async () => {
    await actions.delete!(
      event([
        ['id', ID],
        ['revision', '5'],
      ]) as never,
    )
    expect(deleteDraftPublicDirectoryEntry).toHaveBeenCalledWith(ID, L, 5)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_directory.deleted',
        actorLudoId: L,
        actorMemberId: M,
        entityId: ID,
      }),
    )
    expect(vi.mocked(emitAuditEvent).mock.calls[0][0].metadata).toBeUndefined()
  })
  it.each(['published', 'hidden'])(
    'refuse via le service la suppression d’une entrée %s',
    async () => {
      vi.mocked(deleteDraftPublicDirectoryEntry).mockRejectedValue(
        new PublicDirectoryServiceError('Seul un brouillon peut être supprimé.'),
      )
      const result = await actions.delete!(
        event([
          ['id', ID],
          ['revision', '5'],
        ]) as never,
      )
      expect(result).toMatchObject({
        status: 400,
        data: { error: expect.stringContaining('brouillon') },
      })
      expect(emitAuditEvent).not.toHaveBeenCalled()
    },
  )
  it('rejette une révision CAS invalide avant le service', async () => {
    const result = await actions.delete!(
      event([
        ['id', ID],
        ['revision', '0'],
      ]) as never,
    )
    expect(result).toMatchObject({ status: 400 })
    expect(deleteDraftPublicDirectoryEntry).not.toHaveBeenCalled()
  })
})
