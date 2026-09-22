import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/media/blob-storage.js', () => ({ deletePublicSiteMedia: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/services/public-site.js', () => ({ isPublicSiteEnabled: vi.fn() }))
vi.mock('$lib/server/services/public-news.js', () => ({
  PublicNewsServiceError: class extends Error {}, authorizePublicNewsMediaScope: vi.fn(), getPublicNews: vi.fn(), permanentlyDeletePublicNews: vi.fn(),
}))
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { deletePublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import { authorizePublicNewsMediaScope, getPublicNews, permanentlyDeletePublicNews } from '$lib/server/services/public-news.js'
import { actions } from './+page.server.js'

const L = '11111111-1111-4111-8111-111111111111', M = '22222222-2222-4222-8222-222222222222', ID = '33333333-3333-4333-8333-333333333333'
function event() { const data = new FormData(); data.set('revision', '4'); return { params: { id: ID, ludo: 'demo' }, request: new Request('http://x', { method: 'POST', body: data }) } }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireLudoContext).mockResolvedValue({ ludo: { id: L, slug: 'demo' }, member: { id: M } } as never); vi.mocked(isPublicSiteEnabled).mockResolvedValue(true); vi.mocked(authorizePublicNewsMediaScope).mockResolvedValue({ ludoId: L, domain: 'news', entityId: ID } as never); vi.mocked(permanentlyDeletePublicNews).mockResolvedValue(undefined); vi.mocked(deletePublicSiteMedia).mockResolvedValue(undefined) })

describe('suppression directe d’une actualité', () => {
  it.each(['published', 'hidden'] as const)('supprime une actualité %s, puis nettoie ses fichiers', async (status) => {
    vi.mocked(getPublicNews).mockResolvedValue({ id: ID, status, revision: 4, imageStorageKey: 'image.webp', assets: [{ storageKey: 'programme.pdf' }] } as never)
    await expect(actions.delete!(event() as never)).rejects.toMatchObject({ status: 303, location: '/demo/site-public/actualites' })
    expect(permanentlyDeletePublicNews).toHaveBeenCalledWith(ID, L, 4)
    expect(deletePublicSiteMedia).toHaveBeenCalledTimes(2)
    expect(emitAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'public_news.deleted', entityId: ID }))
  })
})
