import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({ requireLudoContext: vi.fn() }))
vi.mock('$lib/server/db/sites.js', () => ({ listSiteRowsWithOpeningHours: vi.fn() }))
vi.mock('$lib/server/services/public-announcements.js', () => {
  class PublicAnnouncementServiceError extends Error {}
  return {
    PublicAnnouncementServiceError,
    listPublicAnnouncementsForManagement: vi.fn(),
    createPublicAnnouncement: vi.fn(),
    updatePublicAnnouncement: vi.fn(),
    setPublicAnnouncementActive: vi.fn(),
  }
})
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return {
    PublicSiteServiceError,
    isPublicSiteEnabled: vi.fn(),
  }
})
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))

import { requireLudoContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import {
  createPublicAnnouncement,
  listPublicAnnouncementsForManagement,
  PublicAnnouncementServiceError,
  setPublicAnnouncementActive,
  updatePublicAnnouncement,
} from '$lib/server/services/public-announcements.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const ANNOUNCEMENT_ID = '33333333-3333-4333-8333-333333333333'
const SITE_A = '44444444-4444-4444-8444-444444444444'
const SITE_B = '55555555-5555-4555-8555-555555555555'

const announcement = {
  id: ANNOUNCEMENT_ID,
  ludoId: LUDO_ID,
  title: 'Fermeture',
  message: 'Fermeture exceptionnelle.',
  status: 'draft',
  revision: 1,
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID, role: 'member', isActive: true },
  } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicAnnouncementsForManagement).mockResolvedValue([announcement] as never)
  vi.mocked(listSiteRowsWithOpeningHours).mockResolvedValue([
    { id: SITE_A, ludoId: LUDO_ID, name: 'Pâquis', isActive: true },
    { id: SITE_B, ludoId: LUDO_ID, name: 'Sécheron', isActive: false },
  ] as never)
  vi.mocked(createPublicAnnouncement).mockResolvedValue(announcement as never)
  vi.mocked(updatePublicAnnouncement).mockResolvedValue(announcement as never)
  vi.mocked(setPublicAnnouncementActive).mockResolvedValue({
    announcement: { ...announcement, status: 'published', revision: 2 },
    changed: true,
    previousStatus: 'draft',
  } as never)
})

describe('load annonces', () => {
  it('ouvre la gestion à un membre actif et charge uniquement son tenant', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({
      announcements: [announcement],
      sites: [
        expect.objectContaining({ id: SITE_A, isActive: true }),
        expect.objectContaining({ id: SITE_B, isActive: false }),
      ],
    })
    expect(requireLudoContext).toHaveBeenCalledOnce()
    expect(listPublicAnnouncementsForManagement).toHaveBeenCalledWith(LUDO_ID)
    expect(listSiteRowsWithOpeningHours).toHaveBeenCalledWith(LUDO_ID)
  })

  it('répond 404 lorsque le module est désactivé avant toute lecture métier', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)

    await expect(load(event() as never)).rejects.toMatchObject({ status: 404 })
    expect(listPublicAnnouncementsForManagement).not.toHaveBeenCalled()
    expect(listSiteRowsWithOpeningHours).not.toHaveBeenCalled()
  })
})

describe('actions annonces', () => {
  it('crée une annonce visant tous les lieux avec une liste de cibles vide', async () => {
    await actions.create!(
      event([
        ['title', ' Fermeture '],
        ['message', ' Information urgente '],
        ['targetMode', 'all'],
      ]) as never,
    )

    expect(createPublicAnnouncement).toHaveBeenCalledWith(LUDO_ID, MEMBER_ID, {
      title: ' Fermeture ',
      message: ' Information urgente ',
      targetMode: 'all',
      siteIds: [],
    })
    expect(emitAuditEvent).toHaveBeenCalledWith({
      action: 'public_announcement.created',
      actorLudoId: LUDO_ID,
      actorMemberId: MEMBER_ID,
      entityType: 'public_announcement',
      entityId: ANNOUNCEMENT_ID,
      metadata: { targetMode: 'all', targetSiteIds: [] },
    })
    expect(vi.mocked(emitAuditEvent).mock.calls[0][0].metadata).not.toHaveProperty('message')
  })

  it('préserve les cibles répétées FormData lors de la création', async () => {
    await actions.create!(
      event([
        ['title', 'Annonce'],
        ['message', 'Message'],
        ['targetMode', 'explicit'],
        ['siteIds', SITE_A],
        ['siteIds', SITE_B],
      ]) as never,
    )

    expect(createPublicAnnouncement).toHaveBeenCalledWith(
      LUDO_ID,
      MEMBER_ID,
      expect.objectContaining({ targetMode: 'explicit', siteIds: [SITE_A, SITE_B] }),
    )
  })

  it('modifie par id et tenant serveur, avec le membre courant', async () => {
    await actions.update!(
      event([
        ['id', ANNOUNCEMENT_ID],
        ['title', 'Nouveau titre'],
        ['message', 'Nouveau message'],
        ['targetMode', 'explicit'],
        ['siteIds', SITE_A],
        ['revision', '1'],
      ]) as never,
    )

    expect(updatePublicAnnouncement).toHaveBeenCalledWith(
      ANNOUNCEMENT_ID,
      LUDO_ID,
      {
        title: 'Nouveau titre',
        message: 'Nouveau message',
        targetMode: 'explicit',
        siteIds: [SITE_A],
      },
      MEMBER_ID,
      1,
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_announcement.updated',
        actorLudoId: LUDO_ID,
        actorMemberId: MEMBER_ID,
        entityId: ANNOUNCEMENT_ID,
        metadata: { targetMode: 'explicit', targetSiteIds: [SITE_A] },
      }),
    )
  })

  it('n’élargit jamais une ancienne cible inactive vers tous les lieux lors d’un edit texte', async () => {
    const result = await actions.update!(
      event([
        ['id', ANNOUNCEMENT_ID],
        ['title', 'Titre inchangé côté ciblage'],
        ['message', 'Message modifié'],
        ['targetMode', 'explicit'],
        ['revision', '1'],
      ]) as never,
    )

    expect(result).toMatchObject({
      status: 400,
      data: { error: 'Sélectionnez au moins un lieu actif.' },
    })
    expect(updatePublicAnnouncement).not.toHaveBeenCalled()
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('refuse un update sans choix explicite du mode de ciblage', async () => {
    const result = await actions.update!(
      event([
        ['id', ANNOUNCEMENT_ID],
        ['title', 'Titre'],
        ['message', 'Message'],
        ['revision', '1'],
      ]) as never,
    )

    expect(result).toMatchObject({ status: 400 })
    expect(updatePublicAnnouncement).not.toHaveBeenCalled()
  })

  it('audite une activation uniquement lorsqu’elle change réellement le statut', async () => {
    await actions.toggle!(
      event([
        ['id', ANNOUNCEMENT_ID],
        ['active', 'true'],
        ['revision', '1'],
      ]) as never,
    )

    expect(setPublicAnnouncementActive).toHaveBeenCalledWith(
      ANNOUNCEMENT_ID,
      LUDO_ID,
      true,
      MEMBER_ID,
      1,
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_announcement.activated',
        metadata: { fromStatus: 'draft', toStatus: 'published' },
      }),
    )

    vi.clearAllMocks()
    vi.mocked(requireLudoContext).mockResolvedValue({
      ludo: { id: LUDO_ID },
      member: { id: MEMBER_ID },
    } as never)
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
    vi.mocked(setPublicAnnouncementActive).mockResolvedValue({
      announcement: { ...announcement, status: 'published', revision: 1 },
      changed: false,
      previousStatus: 'published',
    } as never)

    await actions.toggle!(
      event([
        ['id', ANNOUNCEMENT_ID],
        ['active', 'true'],
        ['revision', '1'],
      ]) as never,
    )
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('audite une désactivation manuelle', async () => {
    vi.mocked(setPublicAnnouncementActive).mockResolvedValue({
      announcement: { ...announcement, status: 'hidden', revision: 2 },
      changed: true,
      previousStatus: 'published',
    } as never)

    await actions.toggle!(
      event([
        ['id', ANNOUNCEMENT_ID],
        ['active', 'false'],
        ['revision', '1'],
      ]) as never,
    )

    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_announcement.deactivated' }),
    )
  })

  it('refuse une révision absente avant le toggle', async () => {
    const result = await actions.toggle!(
      event([
        ['id', ANNOUNCEMENT_ID],
        ['active', 'true'],
      ]) as never,
    )

    expect(result).toMatchObject({ status: 400 })
    expect(setPublicAnnouncementActive).not.toHaveBeenCalled()
  })

  it('renvoie une erreur de concurrence du service en failure 400', async () => {
    vi.mocked(updatePublicAnnouncement).mockRejectedValue(
      new PublicAnnouncementServiceError(
        "L'annonce a été modifiée simultanément. Rechargez-la avant de réessayer.",
      ),
    )

    const result = await actions.update!(
      event([
        ['id', ANNOUNCEMENT_ID],
        ['title', 'Titre'],
        ['message', 'Message'],
        ['targetMode', 'all'],
        ['revision', '1'],
      ]) as never,
    )

    expect(result).toMatchObject({
      status: 400,
      data: { error: expect.stringContaining('modifiée simultanément') },
    })
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('convertit une erreur métier en failure 400', async () => {
    vi.mocked(createPublicAnnouncement).mockRejectedValue(
      new PublicAnnouncementServiceError('Le titre est requis.'),
    )

    const result = await actions.create!(event([['targetMode', 'all']]) as never)
    expect(result).toMatchObject({ status: 400, data: { error: 'Le titre est requis.' } })
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('refuse un POST direct si le module est désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)

    await expect(actions.create!(event() as never)).rejects.toMatchObject({ status: 404 })
    expect(createPublicAnnouncement).not.toHaveBeenCalled()
  })

  it('laisse le garde de session refuser la mutation avant le service', async () => {
    vi.mocked(requireLudoContext).mockRejectedValue(new Error('session inactive'))

    await expect(actions.update!(event() as never)).rejects.toThrow('session inactive')
    expect(updatePublicAnnouncement).not.toHaveBeenCalled()
  })
})
