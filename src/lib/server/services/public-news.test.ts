import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/public-news.js', () => ({
  deletePublicNewsRow: vi.fn(),
  getPublicNewsRowForLudo: vi.fn(),
  getPublishedPublicNewsRowBySlug: vi.fn(),
  insertPublicNewsAtomic: vi.fn(),
  listPublicNewsRows: vi.fn(),
  listPublishedPublicNewsRows: vi.fn(),
  listVisiblePublicNewsSummaryRows: vi.fn(),
  updatePublicNewsAtomic: vi.fn(),
  updatePublicNewsImageRow: vi.fn(),
  updatePublicNewsPublicationRow: vi.fn(),
}))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows: vi.fn() }))
vi.mock('./public-site.js', () => ({
  isPublicSiteEnabled: vi.fn(),
  validatePublicSiteTargets: vi.fn(),
}))

import {
  getPublicNewsRowForLudo,
  getPublishedPublicNewsRowBySlug,
  insertPublicNewsAtomic,
  listVisiblePublicNewsSummaryRows,
  updatePublicNewsAtomic,
  updatePublicNewsImageRow,
  updatePublicNewsPublicationRow,
} from '../db/public-news.js'
import { listActiveSiteRows } from '../db/sites.js'
import { createAuthorizedMediaScope, publicSiteMediaPath } from '../media/paths.js'
import { isPublicSiteEnabled, validatePublicSiteTargets } from './public-site.js'
import {
  authorizePublicNewsMediaScope,
  createPublicNews,
  clearPublicNewsImage,
  getPublicNews,
  getVisiblePublicNewsBySlug,
  hidePublicNews,
  listLatestVisiblePublicNews,
  listVisiblePublicNewsSummaries,
  normalizePublicNewsSlug,
  publishPublicNews,
  PublicNewsServiceError,
  setPublicNewsImage,
  updatePublicNews,
  validatePublicNewsMarkdown,
} from './public-news.js'

const LUDO = 'ludo-a'
const OTHER = 'ludo-b'
const MEMBER = 'member-a'
const NOW = new Date('2026-08-05T12:00:00Z')
const FIRST = new Date('2026-08-01T09:00:00Z')
const SITE = { id: 'site-a', ludoId: LUDO, isActive: true, isPrimary: true }
const MEDIA_LUDO = '00000000-0000-4000-8000-000000000001'
const MEDIA_NEWS = '00000000-0000-4000-8000-000000000002'
const MEDIA_MEMBER = '00000000-0000-4000-8000-000000000003'

function news(overrides: Record<string, unknown> = {}) {
  return {
    id: 'news-a',
    ludoId: LUDO,
    slug: 'fete-du-jeu',
    title: 'Fête du jeu',
    summary: 'Une journée pour jouer.',
    body: '## Programme\n\nBienvenue.',
    imageUrl: null,
    imageStorageKey: null,
    imageAlt: null,
    status: 'draft',
    revision: 1,
    authorMemberId: MEMBER,
    updatedByMemberId: MEMBER,
    publishedByMemberId: null,
    publishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    author: null,
    updatedBy: null,
    publishedBy: null,
    targets: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(validatePublicSiteTargets).mockResolvedValue([])
  vi.mocked(listActiveSiteRows).mockResolvedValue([SITE] as never)
  vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(news() as never)
  vi.mocked(insertPublicNewsAtomic).mockResolvedValue(news() as never)
  vi.mocked(updatePublicNewsAtomic).mockResolvedValue(news({ revision: 2 }) as never)
  vi.mocked(updatePublicNewsImageRow).mockResolvedValue(news({ revision: 2 }) as never)
  vi.mocked(updatePublicNewsPublicationRow).mockResolvedValue(news({ revision: 2 }) as never)
  vi.mocked(listVisiblePublicNewsSummaryRows).mockResolvedValue([])
  vi.mocked(getPublishedPublicNewsRowBySlug).mockResolvedValue(undefined)
})

describe('création et ciblage', () => {
  it('normalise un slug stable', () => {
    expect(normalizePublicNewsSlug('  Fête de l’Été 2026! ')).toBe('fete-de-l-ete-2026')
  })

  it('normalise les fins de ligne Markdown et refuse HTML ou liens dangereux', () => {
    expect(validatePublicNewsMarkdown('Ligne 1\r\n\r\nLigne 2')).toBe('Ligne 1\n\nLigne 2')
    expect(() => validatePublicNewsMarkdown('<script>alert(1)</script>')).toThrow(/HTML brut/)
    expect(() => validatePublicNewsMarkdown('[clic](javascript:alert(1))')).toThrow(
      /lien non autorisé/,
    )
    expect(() => validatePublicNewsMarkdown('[ref]: data:text/html,test')).toThrow(
      /lien non autorisé/,
    )
    expect(() => validatePublicNewsMarkdown('<javascript:alert(1)>')).toThrow(/HTML brut/)
    expect(() => validatePublicNewsMarkdown('[clic](java&#x73;cript:alert(1))')).toThrow(
      /lien non autorisé/,
    )
    expect(() => validatePublicNewsMarkdown('[clic](javascript\\:alert(1))')).toThrow(
      /lien non autorisé/,
    )
    expect(() => validatePublicNewsMarkdown('[foo [bar]](javascript:alert(1))')).toThrow(
      /lien non autorisé/,
    )
    expect(() => validatePublicNewsMarkdown('[foo \\]](javascript:alert(1))')).toThrow(
      /lien non autorisé/,
    )
    expect(() => validatePublicNewsMarkdown('[foo\nbar](javascript:alert(1))')).toThrow(
      /lien non autorisé/,
    )
    expect(() =>
      validatePublicNewsMarkdown('[x][foo \\]]\n\n[foo \\]]: javascript:alert(1)'),
    ).toThrow(/lien non autorisé/)
  })

  it('crée un brouillon Markdown sans image arbitraire et avec des cibles actives', async () => {
    await createPublicNews(
      LUDO,
      MEMBER,
      {
        slug: 'Nouvelle soirée',
        title: 'Soirée jeux',
        summary: 'Résumé',
        body: '**Vendredi** à 19 h.',
        targetMode: 'explicit',
        siteIds: ['site-a'],
      },
      NOW,
    )
    expect(validatePublicSiteTargets).toHaveBeenCalledWith(LUDO, ['site-a'])
    expect(insertPublicNewsAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        ludoId: LUDO,
        slug: 'nouvelle-soiree',
        body: '**Vendredi** à 19 h.',
        revision: 1,
        imageUrl: null,
        imageStorageKey: null,
        imageAlt: null,
      }),
      ['site-a'],
    )
  })

  it('rejette explicit vide et all non vide', async () => {
    const base = { slug: 'x', title: 'Titre', summary: 'Résumé', body: 'Corps' }
    await expect(
      createPublicNews(LUDO, MEMBER, {
        ...base,
        targetMode: 'explicit',
        siteIds: [],
      }),
    ).rejects.toThrow(/au moins un lieu actif/)
    await expect(
      createPublicNews(LUDO, MEMBER, {
        ...base,
        targetMode: 'all',
        siteIds: ['site-a'],
      } as never),
    ).rejects.toThrow(/liste de lieux vide/)
  })

  it('rejette une cible inactive sans la convertir en tous les lieux', async () => {
    vi.mocked(validatePublicSiteTargets).mockRejectedValue(new Error('lieu inactif'))
    await expect(
      createPublicNews(LUDO, MEMBER, {
        slug: 'x',
        title: 'Titre',
        summary: 'Résumé',
        body: 'Corps',
        targetMode: 'explicit',
        siteIds: ['inactive'],
      }),
    ).rejects.toThrow(/inactif/)
    expect(insertPublicNewsAtomic).not.toHaveBeenCalled()
  })

  it('ignore les champs image forgés dans l’input générique', async () => {
    await createPublicNews(LUDO, MEMBER, {
      slug: 'x',
      title: 'Titre',
      summary: 'Résumé',
      body: 'Corps',
      imageUrl: 'https://evil.test/image.webp',
      imageStorageKey: 'forged/path',
      imageAlt: 'Forgé',
      targetMode: 'all',
      siteIds: [],
    } as never)
    expect(insertPublicNewsAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: null, imageStorageKey: null, imageAlt: null }),
      [],
    )
  })

  it('transforme une collision de slug en erreur métier', async () => {
    vi.mocked(insertPublicNewsAtomic).mockRejectedValue({ code: '23505' })
    await expect(
      createPublicNews(LUDO, MEMBER, {
        slug: 'déjà-pris',
        title: 'Titre',
        summary: 'Résumé',
        body: 'Corps',
        targetMode: 'all',
        siteIds: [],
      }),
    ).rejects.toThrow(/slug est déjà utilisé/)
  })

  it("isole l'accès de gestion par tenant", async () => {
    vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(undefined)
    await expect(getPublicNews('news-a', OTHER)).rejects.toThrow(PublicNewsServiceError)
    expect(getPublicNewsRowForLudo).toHaveBeenCalledWith('news-a', OTHER)
  })
})

describe('mise à jour et concurrence', () => {
  it('permet de changer le slug tant que le contenu n’a jamais été publié', async () => {
    await updatePublicNews('news-a', LUDO, { slug: 'Nouveau titre' }, MEMBER, 1, NOW)
    expect(updatePublicNewsAtomic).toHaveBeenCalledWith(
      'news-a',
      LUDO,
      1,
      expect.objectContaining({ slug: 'nouveau-titre' }),
      [],
    )
  })

  it('fige le slug après la première publication, même cachée', async () => {
    vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(
      news({ status: 'hidden', publishedAt: FIRST, publishedByMemberId: MEMBER }) as never,
    )
    await expect(
      updatePublicNews('news-a', LUDO, { slug: 'autre' }, MEMBER, 1, NOW),
    ).rejects.toThrow(/slug ne peut plus/)
  })

  it('refuse une révision périmée et un CAS perdu après lecture', async () => {
    vi.mocked(getPublicNewsRowForLudo).mockResolvedValueOnce(news({ revision: 2 }) as never)
    await expect(
      updatePublicNews('news-a', LUDO, { title: 'Périmé' }, MEMBER, 1, NOW),
    ).rejects.toThrow(/Rechargez/)

    vi.mocked(getPublicNewsRowForLudo).mockResolvedValueOnce(news() as never)
    vi.mocked(updatePublicNewsAtomic).mockResolvedValueOnce(undefined)
    await expect(
      updatePublicNews('news-a', LUDO, { title: 'Concurrent' }, MEMBER, 1, NOW),
    ).rejects.toThrow(/Rechargez/)
  })

  it('transforme aussi une collision de slug pendant la mise à jour', async () => {
    vi.mocked(updatePublicNewsAtomic).mockRejectedValue({ code: '23505' })
    await expect(
      updatePublicNews('news-a', LUDO, { slug: 'déjà-pris' }, MEMBER, 1, NOW),
    ).rejects.toThrow(/slug est déjà utilisé/)
  })
})

describe('publication manuelle', () => {
  it('retourne une erreur métier si on tente de cacher un brouillon', async () => {
    await expect(hidePublicNews('news-a', LUDO, MEMBER, 1, NOW)).rejects.toThrow(/brouillon/)
    expect(updatePublicNewsPublicationRow).not.toHaveBeenCalled()
  })

  it('exige que le module public soit actif', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(publishPublicNews('news-a', LUDO, MEMBER, 1, NOW)).rejects.toThrow(/module public/)
    expect(updatePublicNewsPublicationRow).not.toHaveBeenCalled()
  })

  it('revalide les cibles actives au moment de publier', async () => {
    vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(
      news({ targets: [{ siteId: 'site-a', ludoId: LUDO }] }) as never,
    )
    vi.mocked(validatePublicSiteTargets).mockRejectedValue(new Error('inactif'))
    await expect(publishPublicNews('news-a', LUDO, MEMBER, 1, NOW)).rejects.toThrow(/inactif/)
  })

  it('conserve la première date et le premier publicateur lors d’une republication', async () => {
    vi.mocked(getPublicNewsRowForLudo)
      .mockResolvedValueOnce(
        news({
          status: 'hidden',
          publishedAt: FIRST,
          publishedByMemberId: 'first-member',
        }) as never,
      )
      .mockResolvedValueOnce(news({ status: 'published', revision: 2 }) as never)
    await publishPublicNews('news-a', LUDO, MEMBER, 1, NOW)
    expect(updatePublicNewsPublicationRow).toHaveBeenCalledWith(
      'news-a',
      LUDO,
      'hidden',
      1,
      expect.objectContaining({
        status: 'published',
        publishedAt: FIRST,
        publishedByMemberId: 'first-member',
      }),
    )
  })

  it('publie puis cache explicitement avec CAS', async () => {
    await publishPublicNews('news-a', LUDO, MEMBER, 1, NOW)
    expect(updatePublicNewsPublicationRow).toHaveBeenCalledWith(
      'news-a',
      LUDO,
      'draft',
      1,
      expect.objectContaining({ status: 'published' }),
    )

    vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(
      news({ status: 'published', publishedAt: FIRST, publishedByMemberId: MEMBER }) as never,
    )
    await hidePublicNews('news-a', LUDO, MEMBER, 1, NOW)
    expect(updatePublicNewsPublicationRow).toHaveBeenLastCalledWith(
      'news-a',
      LUDO,
      'published',
      1,
      expect.objectContaining({ status: 'hidden' }),
    )
  })

  it('maîtrise idempotence et conflits de publication par révision', async () => {
    const published = news({
      status: 'published',
      revision: 2,
      publishedAt: FIRST,
      publishedByMemberId: MEMBER,
    })
    vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(published as never)
    await expect(publishPublicNews('news-a', LUDO, MEMBER, 2, NOW)).resolves.toEqual({
      news: published,
      changed: false,
      previousStatus: 'published',
    })
    await expect(publishPublicNews('news-a', LUDO, MEMBER, 1, NOW)).rejects.toThrow(/Rechargez/)

    vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(news() as never)
    vi.mocked(updatePublicNewsPublicationRow).mockResolvedValue(undefined)
    await expect(publishPublicNews('news-a', LUDO, MEMBER, 1, NOW)).rejects.toThrow(/Rechargez/)
  })
})

describe('ownership image', () => {
  function mediaFixture(entityId = MEDIA_NEWS, contentType = 'image/webp') {
    const scope = createAuthorizedMediaScope({
      ludoId: MEDIA_LUDO,
      domain: 'news',
      entityId,
    })
    return {
      scope,
      blob: {
        url: 'https://cdn.test/cover.webp',
        downloadUrl: 'https://cdn.test/cover.webp',
        pathname: publicSiteMediaPath({
          scope,
          mediaType: contentType as 'image/webp',
          blobId: '00000000-0000-4000-8000-000000000004',
        }),
        contentType,
        size: 120,
      },
    }
  }

  it('autorise uniquement une actualité du tenant à la révision attendue', async () => {
    vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(
      news({ id: MEDIA_NEWS, ludoId: MEDIA_LUDO, revision: 3 }) as never,
    )
    await expect(authorizePublicNewsMediaScope(MEDIA_LUDO, MEDIA_NEWS, 3)).resolves.toEqual(
      expect.objectContaining({ ludoId: MEDIA_LUDO, domain: 'news', entityId: MEDIA_NEWS }),
    )
    await expect(authorizePublicNewsMediaScope(MEDIA_LUDO, MEDIA_NEWS, 2)).rejects.toThrow(
      /Rechargez/,
    )
  })

  it('rejette scope tenant/domaine/entity et pathname forgés ainsi que les PDF', async () => {
    const valid = mediaFixture()
    const otherEntity = '00000000-0000-4000-8000-000000000005'
    const badScopes = [
      createAuthorizedMediaScope({
        ludoId: '00000000-0000-4000-8000-000000000006',
        domain: 'news',
        entityId: MEDIA_NEWS,
      }),
      createAuthorizedMediaScope({ ludoId: MEDIA_LUDO, domain: 'gallery', entityId: MEDIA_NEWS }),
      createAuthorizedMediaScope({ ludoId: MEDIA_LUDO, domain: 'news', entityId: otherEntity }),
    ]
    for (const scope of badScopes) {
      await expect(
        setPublicNewsImage(
          MEDIA_LUDO,
          MEDIA_NEWS,
          MEDIA_MEMBER,
          1,
          scope,
          valid.blob as never,
          'Alt',
        ),
      ).rejects.toThrow(/n'appartient pas/)
    }

    const wrongPath = mediaFixture(otherEntity)
    await expect(
      setPublicNewsImage(
        MEDIA_LUDO,
        MEDIA_NEWS,
        MEDIA_MEMBER,
        1,
        valid.scope,
        wrongPath.blob as never,
        'Alt',
      ),
    ).rejects.toThrow(/chemin/)

    await expect(
      setPublicNewsImage(
        MEDIA_LUDO,
        MEDIA_NEWS,
        MEDIA_MEMBER,
        1,
        valid.scope,
        { ...valid.blob, contentType: 'application/pdf' } as never,
        'Alt',
      ),
    ).rejects.toThrow(/doit être une image/)
  })

  it('enregistre et efface par CAS en retournant l’ancienne clé', async () => {
    const { scope, blob } = mediaFixture()
    const current = news({
      id: MEDIA_NEWS,
      ludoId: MEDIA_LUDO,
      imageStorageKey: 'old/key.webp',
    })
    const updated = news({ id: MEDIA_NEWS, ludoId: MEDIA_LUDO, revision: 2 })
    vi.mocked(getPublicNewsRowForLudo)
      .mockResolvedValueOnce(current as never)
      .mockResolvedValueOnce(updated as never)

    await expect(
      setPublicNewsImage(
        MEDIA_LUDO,
        MEDIA_NEWS,
        MEDIA_MEMBER,
        1,
        scope,
        blob as never,
        'Couverture',
        NOW,
      ),
    ).resolves.toEqual({ news: updated, previousStorageKey: 'old/key.webp' })
    expect(updatePublicNewsImageRow).toHaveBeenCalledWith(
      MEDIA_NEWS,
      MEDIA_LUDO,
      1,
      expect.objectContaining({
        imageUrl: blob.url,
        imageStorageKey: blob.pathname,
        imageAlt: 'Couverture',
      }),
    )

    vi.mocked(getPublicNewsRowForLudo)
      .mockResolvedValueOnce(current as never)
      .mockResolvedValueOnce(updated as never)
    await expect(
      clearPublicNewsImage(MEDIA_LUDO, MEDIA_NEWS, MEDIA_MEMBER, 1, NOW),
    ).resolves.toEqual({ news: updated, previousStorageKey: 'old/key.webp' })
    expect(updatePublicNewsImageRow).toHaveBeenLastCalledWith(
      MEDIA_NEWS,
      MEDIA_LUDO,
      1,
      expect.objectContaining({ imageUrl: null, imageStorageKey: null, imageAlt: null }),
    )
  })

  it('refuse un CAS image perdu', async () => {
    const { scope, blob } = mediaFixture()
    vi.mocked(getPublicNewsRowForLudo).mockResolvedValue(
      news({ id: MEDIA_NEWS, ludoId: MEDIA_LUDO }) as never,
    )
    vi.mocked(updatePublicNewsImageRow).mockResolvedValue(undefined)
    await expect(
      setPublicNewsImage(MEDIA_LUDO, MEDIA_NEWS, MEDIA_MEMBER, 1, scope, blob as never, 'Alt'),
    ).rejects.toThrow(/Rechargez/)
  })
})

describe('lecture publique', () => {
  it('retourne au plus les trois actualités visibles les plus récentes', async () => {
    vi.mocked(listVisiblePublicNewsSummaryRows).mockResolvedValue(
      [1, 2, 3].map((index) => ({
        id: `news-${index}`,
        ludoId: LUDO,
        slug: `news-${index}`,
        title: 'Titre',
        summary: 'Résumé',
        imageUrl: null,
        imageAlt: null,
        publishedAt: FIRST,
      })),
    )
    const latest = await listLatestVisiblePublicNews(LUDO)
    expect(latest.map((item) => item.id)).toEqual(['news-1', 'news-2', 'news-3'])
    expect(listVisiblePublicNewsSummaryRows).toHaveBeenCalledWith(LUDO, undefined, 3)
  })

  it('borne la liste en base à 20 par défaut et 50 au maximum', async () => {
    await listVisiblePublicNewsSummaries(LUDO)
    expect(listVisiblePublicNewsSummaryRows).toHaveBeenLastCalledWith(LUDO, undefined, 20)
    await listVisiblePublicNewsSummaries(LUDO, undefined, 500)
    expect(listVisiblePublicNewsSummaryRows).toHaveBeenLastCalledWith(LUDO, undefined, 50)
  })

  it('masque liste et détail si le tenant, le module ou le lieu ne convient pas', async () => {
    vi.mocked(getPublishedPublicNewsRowBySlug).mockResolvedValue(
      news({ status: 'published', targets: [{ siteId: 'site-a', ludoId: LUDO }] }) as never,
    )
    await expect(getVisiblePublicNewsBySlug(LUDO, 'Fête du jeu', 'site-a')).resolves.toEqual(
      expect.objectContaining({ id: 'news-a' }),
    )
    expect(getPublishedPublicNewsRowBySlug).toHaveBeenCalledWith(LUDO, 'fete-du-jeu')

    await expect(
      getVisiblePublicNewsBySlug(LUDO, 'fete-du-jeu', 'inactive'),
    ).resolves.toBeUndefined()
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(listLatestVisiblePublicNews(LUDO)).resolves.toEqual([])
  })

  it('retourne undefined pour un slug public invalide', async () => {
    await expect(getVisiblePublicNewsBySlug(LUDO, '!!!')).resolves.toBeUndefined()
    expect(getPublishedPublicNewsRowBySlug).not.toHaveBeenCalled()
  })
})
