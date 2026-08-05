import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/db/sites.js', () => ({ listSiteRowsWithOpeningHours: vi.fn() }))
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
vi.mock('$lib/server/services/public-news.js', () => {
  class PublicNewsServiceError extends Error {}
  return {
    PublicNewsServiceError,
    listPublicNewsForManagement: vi.fn(),
    createPublicNews: vi.fn(),
    updatePublicNews: vi.fn(),
    publishPublicNews: vi.fn(),
    hidePublicNews: vi.fn(),
    authorizePublicNewsMediaScope: vi.fn(),
    setPublicNewsImage: vi.fn(),
    clearPublicNewsImage: vi.fn(),
  }
})
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))

import { requireLudoContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { deletePublicSiteMedia, uploadPublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import {
  authorizePublicNewsMediaScope,
  clearPublicNewsImage,
  createPublicNews,
  hidePublicNews,
  listPublicNewsForManagement,
  publishPublicNews,
  PublicNewsServiceError,
  setPublicNewsImage,
  updatePublicNews,
} from '$lib/server/services/public-news.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const NEWS_ID = '33333333-3333-4333-8333-333333333333'
const SITE_ACTIVE = '44444444-4444-4444-8444-444444444444'
const SITE_INACTIVE = '55555555-5555-4555-8555-555555555555'
const SCOPE = {
  ludoId: LUDO_ID,
  domain: 'news',
  entityId: NEWS_ID,
} as never
const NEW_PATH = `public-site/${LUDO_ID}/news/${NEWS_ID}/66666666-6666-4666-8666-666666666666.jpg`
const OLD_PATH = `public-site/${LUDO_ID}/news/${NEWS_ID}/77777777-7777-4777-8777-777777777777.jpg`
const storedBlob = {
  url: 'https://blob.test/new.jpg',
  downloadUrl: 'https://blob.test/new.jpg?download=1',
  pathname: NEW_PATH,
  contentType: 'image/jpeg',
  size: 4,
}

const news = {
  id: NEWS_ID,
  ludoId: LUDO_ID,
  slug: 'nouvelle-actualite',
  title: 'Nouvelle actualité',
  summary: 'Un résumé public.',
  body: '## Contenu\n\nDu Markdown.',
  imageUrl: null,
  imageStorageKey: null,
  imageAlt: null,
  status: 'draft',
  revision: 1,
  publishedAt: null,
  targets: [],
}

function event(fields: Array<[string, string]> = []) {
  const formData = new FormData()
  for (const [name, value] of fields) formData.append(name, value)
  return {
    params: { ludo: 'test' },
    locals: {},
    cookies: {},
    request: new Request('http://local.test', { method: 'POST', body: formData }),
  }
}

function imageEvent(file: FormDataEntryValue, alt = 'Enfants autour d’un jeu') {
  const formData = new FormData()
  formData.set('id', NEWS_ID)
  formData.set('revision', '1')
  formData.set('file', file)
  formData.set('alt', alt)
  return {
    params: { ludo: 'test' },
    locals: {},
    cookies: {},
    request: new Request('http://local.test', { method: 'POST', body: formData }),
  }
}

function newsFields(extra: Array<[string, string]> = []): Array<[string, string]> {
  return [
    ['slug', 'nouvelle-actualite'],
    ['title', 'Nouvelle actualité'],
    ['summary', 'Un résumé public.'],
    ['body', '## Contenu\n\nDu Markdown.'],
    ...extra,
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID, role: 'member', isActive: true },
  } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicNewsForManagement).mockResolvedValue([news] as never)
  vi.mocked(listSiteRowsWithOpeningHours).mockResolvedValue([
    { id: SITE_ACTIVE, ludoId: LUDO_ID, name: 'Pâquis', isActive: true },
    { id: SITE_INACTIVE, ludoId: LUDO_ID, name: 'Sécheron', isActive: false },
  ] as never)
  vi.mocked(createPublicNews).mockResolvedValue(news as never)
  vi.mocked(updatePublicNews).mockResolvedValue(news as never)
  vi.mocked(publishPublicNews).mockResolvedValue({
    news: { ...news, status: 'published', revision: 2, publishedAt: new Date() },
    changed: true,
    previousStatus: 'draft',
  } as never)
  vi.mocked(hidePublicNews).mockResolvedValue({
    news: { ...news, status: 'hidden', revision: 2, publishedAt: new Date() },
    changed: true,
    previousStatus: 'published',
  } as never)
  vi.mocked(authorizePublicNewsMediaScope).mockResolvedValue(SCOPE)
  vi.mocked(uploadPublicSiteMedia).mockResolvedValue(storedBlob as never)
  vi.mocked(setPublicNewsImage).mockResolvedValue({
    news: { ...news, revision: 2, imageUrl: storedBlob.url, imageStorageKey: NEW_PATH },
    previousStorageKey: OLD_PATH,
  } as never)
  vi.mocked(clearPublicNewsImage).mockResolvedValue({
    news: { ...news, revision: 2 },
    previousStorageKey: OLD_PATH,
  } as never)
  vi.mocked(uploadAndRegisterMedia).mockImplementation(async (input) => {
    const scope = await input.authorize()
    const blob = await input.upload(scope)
    try {
      return await input.register(scope, blob)
    } catch (error) {
      await input.cleanup(scope, blob.pathname)
      throw error
    }
  })
})

describe('load actualités', () => {
  it('charge les brouillons du tenant et tous ses lieux pour un membre actif', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({
      news: [news],
      sites: [
        expect.objectContaining({ id: SITE_ACTIVE, isActive: true }),
        expect.objectContaining({ id: SITE_INACTIVE, isActive: false }),
      ],
    })
    expect(listPublicNewsForManagement).toHaveBeenCalledWith(LUDO_ID)
    expect(listSiteRowsWithOpeningHours).toHaveBeenCalledWith(LUDO_ID)
  })

  it('répond 404 avant toute lecture métier lorsque le module est désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(load(event() as never)).rejects.toMatchObject({ status: 404 })
    expect(listPublicNewsForManagement).not.toHaveBeenCalled()
  })
})

describe('actions actualités', () => {
  it('crée un brouillon tenant-scopé avec auteur et ciblage tous', async () => {
    await actions.create!(event(newsFields([['targetMode', 'all']])) as never)

    expect(createPublicNews).toHaveBeenCalledWith(LUDO_ID, MEMBER_ID, {
      slug: 'nouvelle-actualite',
      title: 'Nouvelle actualité',
      summary: 'Un résumé public.',
      body: '## Contenu\n\nDu Markdown.',
      targetMode: 'all',
      siteIds: [],
    })
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_news.created',
        actorLudoId: LUDO_ID,
        actorMemberId: MEMBER_ID,
        entityId: NEWS_ID,
        metadata: { targetMode: 'all', targetSiteIds: [] },
      }),
    )
    const metadata = vi.mocked(emitAuditEvent).mock.calls[0][0].metadata
    expect(metadata).not.toHaveProperty('summary')
    expect(metadata).not.toHaveProperty('body')
  })

  it('met à jour avec ciblage explicite, acteur et révision CAS', async () => {
    await actions.update!(
      event(
        newsFields([
          ['id', NEWS_ID],
          ['targetMode', 'explicit'],
          ['siteIds', SITE_ACTIVE],
          ['revision', '3'],
        ]),
      ) as never,
    )

    expect(updatePublicNews).toHaveBeenCalledWith(
      NEWS_ID,
      LUDO_ID,
      expect.objectContaining({ targetMode: 'explicit', siteIds: [SITE_ACTIVE] }),
      MEMBER_ID,
      3,
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_news.updated', actorMemberId: MEMBER_ID }),
    )
  })

  it('omet le slug sur une édition post-publication', async () => {
    const fields = newsFields([
      ['id', NEWS_ID],
      ['targetMode', 'all'],
      ['revision', '2'],
    ]).filter(([name]) => name !== 'slug')
    await actions.update!(event(fields) as never)

    expect(updatePublicNews).toHaveBeenCalledWith(
      NEWS_ID,
      LUDO_ID,
      expect.not.objectContaining({ slug: expect.anything() }),
      MEMBER_ID,
      2,
    )
  })

  it('refuse un ciblage explicite vide au lieu de l’élargir aux lieux actifs', async () => {
    const result = await actions.update!(
      event(
        newsFields([
          ['id', NEWS_ID],
          ['targetMode', 'explicit'],
          ['revision', '1'],
        ]),
      ) as never,
    )
    expect(result).toMatchObject({ status: 400 })
    expect(updatePublicNews).not.toHaveBeenCalled()
  })

  it('publie avec révision et audite seulement une transition réelle', async () => {
    await actions.transition!(
      event([
        ['id', NEWS_ID],
        ['status', 'published'],
        ['revision', '1'],
      ]) as never,
    )
    expect(publishPublicNews).toHaveBeenCalledWith(NEWS_ID, LUDO_ID, MEMBER_ID, 1)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_news.published',
        metadata: { fromStatus: 'draft', toStatus: 'published' },
      }),
    )

    vi.mocked(emitAuditEvent).mockClear()
    vi.mocked(publishPublicNews).mockResolvedValue({
      news: { ...news, status: 'published' },
      changed: false,
      previousStatus: 'published',
    } as never)
    await actions.transition!(
      event([
        ['id', NEWS_ID],
        ['status', 'published'],
        ['revision', '2'],
      ]) as never,
    )
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('masque manuellement une actualité publiée', async () => {
    await actions.transition!(
      event([
        ['id', NEWS_ID],
        ['status', 'hidden'],
        ['revision', '4'],
      ]) as never,
    )
    expect(hidePublicNews).toHaveBeenCalledWith(NEWS_ID, LUDO_ID, MEMBER_ID, 4)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_news.hidden' }),
    )
  })

  it('renvoie les conflits de révision en failure 400', async () => {
    vi.mocked(updatePublicNews).mockRejectedValue(
      new PublicNewsServiceError(
        "L'actualité a été modifiée simultanément. Rechargez-la avant de réessayer.",
      ),
    )
    const result = await actions.update!(
      event(
        newsFields([
          ['id', NEWS_ID],
          ['targetMode', 'all'],
          ['revision', '1'],
        ]),
      ) as never,
    )
    expect(result).toMatchObject({ status: 400 })
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('expose l’erreur de slug immuable sans auditer', async () => {
    vi.mocked(updatePublicNews).mockRejectedValue(
      new PublicNewsServiceError('Le slug ne peut plus être modifié après publication.'),
    )
    const fields = newsFields([
      ['id', NEWS_ID],
      ['targetMode', 'all'],
      ['revision', '2'],
    ]).filter(([name]) => name !== 'slug')
    fields.push(['slug', 'nouveau-slug'])
    const result = await actions.update!(event(fields) as never)
    expect(result).toMatchObject({
      status: 400,
      data: { error: expect.stringContaining('slug') },
    })
    expect(updatePublicNews).toHaveBeenCalledWith(
      NEWS_ID,
      LUDO_ID,
      expect.objectContaining({ slug: 'nouveau-slug' }),
      MEMBER_ID,
      2,
    )
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('refuse un POST direct lorsque le module est désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(actions.create!(event() as never)).rejects.toMatchObject({ status: 404 })
    expect(createPublicNews).not.toHaveBeenCalled()
  })

  it('laisse le garde de session bloquer toute mutation', async () => {
    vi.mocked(requireLudoContext).mockRejectedValue(new Error('session inactive'))
    await expect(actions.update!(event() as never)).rejects.toThrow('session inactive')
    expect(updatePublicNews).not.toHaveBeenCalled()
  })
})

describe('actions image actualité', () => {
  it('utilise le même scope tenant/news/entité pour autoriser, uploader et enregistrer', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], 'cover.jpg', {
      type: 'image/jpeg',
    })

    await actions.uploadImage!(imageEvent(file) as never)

    expect(authorizePublicNewsMediaScope).toHaveBeenCalledWith(LUDO_ID, NEWS_ID, 1)
    expect(uploadPublicSiteMedia).toHaveBeenCalledWith({
      scope: SCOPE,
      file: expect.objectContaining({
        name: 'cover.jpg',
        type: 'image/jpeg',
        size: 4,
      }),
      policy: {
        maxBytes: 5 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      },
    })
    expect(setPublicNewsImage).toHaveBeenCalledWith(
      LUDO_ID,
      NEWS_ID,
      MEMBER_ID,
      1,
      SCOPE,
      storedBlob,
      'Enfants autour d’un jeu',
    )
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(SCOPE, OLD_PATH)
    const audit = vi
      .mocked(emitAuditEvent)
      .mock.calls.find(([entry]) => entry.action === 'public_news.image_updated')?.[0]
    expect(audit).toMatchObject({ entityId: NEWS_ID, metadata: { hadPreviousImage: true } })
    expect(JSON.stringify(audit)).not.toContain('https://')
  })

  it('refuse un champ fichier invalide avant l’orchestrateur', async () => {
    const result = await actions.uploadImage!(imageEvent('pas-un-fichier') as never)

    expect(result).toMatchObject({ status: 400 })
    expect(uploadAndRegisterMedia).not.toHaveBeenCalled()
    expect(uploadPublicSiteMedia).not.toHaveBeenCalled()
  })

  it('compense le nouveau blob si le register CAS échoue', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], 'cover.jpg', {
      type: 'image/jpeg',
    })
    vi.mocked(setPublicNewsImage).mockRejectedValue(
      new PublicNewsServiceError(
        "L'actualité a été modifiée simultanément. Rechargez-la avant de réessayer.",
      ),
    )

    const result = await actions.uploadImage!(imageEvent(file) as never)

    expect(result).toMatchObject({ status: 400 })
    expect(deletePublicSiteMedia).toHaveBeenCalledTimes(1)
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(SCOPE, NEW_PATH)
    expect(emitAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_news.image_updated' }),
    )
  })

  it('supprime l’ancien blob seulement après le register réussi', async () => {
    const order: string[] = []
    vi.mocked(setPublicNewsImage).mockImplementation(async () => {
      order.push('register')
      return {
        news: { ...news, revision: 2 },
        previousStorageKey: OLD_PATH,
      } as never
    })
    vi.mocked(deletePublicSiteMedia).mockImplementation(async () => {
      order.push('delete-old')
    })
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], 'cover.jpg', {
      type: 'image/jpeg',
    })

    await actions.uploadImage!(imageEvent(file) as never)

    expect(order).toEqual(['register', 'delete-old'])
  })

  it('retire la référence CAS puis supprime l’ancien blob dans le scope autorisé', async () => {
    await actions.removeImage!(
      event([
        ['id', NEWS_ID],
        ['revision', '1'],
      ]) as never,
    )

    expect(authorizePublicNewsMediaScope).toHaveBeenCalledWith(LUDO_ID, NEWS_ID, 1)
    expect(clearPublicNewsImage).toHaveBeenCalledWith(LUDO_ID, NEWS_ID, MEMBER_ID, 1)
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(SCOPE, OLD_PATH)
    const audit = vi
      .mocked(emitAuditEvent)
      .mock.calls.find(([entry]) => entry.action === 'public_news.image_removed')?.[0]
    expect(audit).toMatchObject({ entityId: NEWS_ID })
    expect(JSON.stringify(audit)).not.toContain('https://')
  })

  it('ne transforme pas un échec de nettoyage ancien en faux rollback', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(deletePublicSiteMedia).mockRejectedValue(new Error('blob indisponible'))
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], 'cover.jpg', {
      type: 'image/jpeg',
    })

    const result = await actions.uploadImage!(imageEvent(file) as never)

    expect(result).toEqual({ success: true })
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_news.image_cleanup_failed',
        metadata: { operation: 'replace' },
      }),
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_news.image_updated' }),
    )
    consoleError.mockRestore()
  })

  it('n’upload rien si le service refuse l’entité du tenant courant', async () => {
    vi.mocked(authorizePublicNewsMediaScope).mockRejectedValue(
      new PublicNewsServiceError('Actualité introuvable.'),
    )
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], 'cover.jpg', {
      type: 'image/jpeg',
    })

    const result = await actions.uploadImage!(imageEvent(file) as never)

    expect(result).toMatchObject({ status: 400 })
    expect(authorizePublicNewsMediaScope).toHaveBeenCalledWith(LUDO_ID, NEWS_ID, 1)
    expect(uploadPublicSiteMedia).not.toHaveBeenCalled()
    expect(setPublicNewsImage).not.toHaveBeenCalled()
  })
})
