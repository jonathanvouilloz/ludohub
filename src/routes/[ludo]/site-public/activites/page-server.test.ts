import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/ludo-context.js', () => ({
  requireLudoContext: vi.fn(),
  requireResponsableContext: vi.fn(),
}))
vi.mock('$lib/server/db/sites.js', () => ({ listSiteRowsWithOpeningHours: vi.fn() }))
vi.mock('$lib/server/services/events.js', () => ({ emitAuditEvent: vi.fn() }))
vi.mock('$lib/server/media/blob-storage.js', () => {
  class MediaStorageError extends Error {}
  return { MediaStorageError, uploadPublicSiteMedia: vi.fn(), deletePublicSiteMedia: vi.fn() }
})
vi.mock('$lib/server/media/media-service.js', () => {
  class MediaCompensationError extends Error {}
  return { MediaCompensationError, uploadAndRegisterMedia: vi.fn() }
})
vi.mock('$lib/server/services/public-site.js', () => {
  class PublicSiteServiceError extends Error {}
  return { PublicSiteServiceError, isPublicSiteEnabled: vi.fn() }
})
vi.mock('$lib/server/services/public-activities.js', () => {
  class PublicActivityServiceError extends Error {}
  return {
    PublicActivityServiceError,
    listPublicActivitiesForManagement: vi.fn(),
    getPublicActivity: vi.fn(),
    createPublicActivity: vi.fn(),
    updatePublicActivity: vi.fn(),
    publishPublicActivity: vi.fn(),
    hidePublicActivity: vi.fn(),
    archivePublicActivity: vi.fn(),
    trashPublicActivity: vi.fn(),
    restorePublicActivity: vi.fn(),
    permanentlyDeletePublicActivity: vi.fn(),
    setPublicActivityFeaturedRank: vi.fn(),
    authorizePublicActivityMediaScope: vi.fn(),
    setPublicActivityImage: vi.fn(),
    clearPublicActivityImage: vi.fn(),
  }
})
vi.mock('$lib/server/services/public-activity-registrations.js', () => {
  class PublicActivityRegistrationServiceError extends Error {
    constructor(
      message: string,
      public readonly code: 'invalid' | 'not_found' | 'conflict' = 'invalid',
    ) {
      super(message)
    }
  }
  return {
    PublicActivityRegistrationServiceError,
    listPublicActivityRegistrationsForManagement: vi.fn(),
    transitionPublicActivityRegistration: vi.fn(),
    updatePublicActivityRegistrationSettings: vi.fn(),
  }
})

import { requireLudoContext, requireResponsableContext } from '$lib/server/ludo-context.js'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { deletePublicSiteMedia, uploadPublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import {
  archivePublicActivity,
  authorizePublicActivityMediaScope,
  clearPublicActivityImage,
  createPublicActivity,
  getPublicActivity,
  listPublicActivitiesForManagement,
  permanentlyDeletePublicActivity,
  publishPublicActivity,
  restorePublicActivity,
  setPublicActivityFeaturedRank,
  setPublicActivityImage,
  trashPublicActivity,
  updatePublicActivity,
} from '$lib/server/services/public-activities.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import {
  listPublicActivityRegistrationsForManagement,
  transitionPublicActivityRegistration,
  updatePublicActivityRegistrationSettings,
} from '$lib/server/services/public-activity-registrations.js'
import { actions, load } from './+page.server.js'

const LUDO_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const ACTIVITY_ID = '33333333-3333-4333-8333-333333333333'
const SITE_ID = '44444444-4444-4444-8444-444444444444'
const OLD_PATH = `public-site/${LUDO_ID}/activities/${ACTIVITY_ID}/old.jpg`
const NEW_PATH = `public-site/${LUDO_ID}/activities/${ACTIVITY_ID}/new.jpg`
const scope = { ludoId: LUDO_ID, domain: 'activities', entityId: ACTIVITY_ID } as never
const activity = {
  id: ACTIVITY_ID,
  ludoId: LUDO_ID,
  revision: 1,
  title: 'Soirée jeux',
  status: 'draft',
  lifecycle: 'active',
  imageStorageKey: OLD_PATH,
}

function event(fields: Array<[string, string | File]> = []) {
  const data = new FormData()
  for (const [name, value] of fields) data.append(name, value)
  return {
    params: { ludo: 'test' },
    locals: {},
    cookies: {},
    request: new Request('http://local.test', { method: 'POST', body: data }),
    url: new URL('http://local.test'),
  }
}

function fields(extra: Array<[string, string]> = []): Array<[string, string]> {
  return [
    ['slug', 'soiree-jeux'],
    ['title', 'Soirée jeux'],
    ['summary', 'Une soirée conviviale.'],
    ['body', '## Programme'],
    ['location', 'Grande salle'],
    ['type', 'recurring'],
    ['recurrenceRule', 'FREQ=WEEKLY;BYDAY=WE;COUNT=52'],
    ['dates', JSON.stringify([{ startsAt: '2026-09-02T18:00', endsAt: '2026-09-02T20:00' }])],
    ['exceptions', JSON.stringify([{ excludedAt: '2026-09-09T18:00', reason: 'Fermeture' }])],
    ...extra,
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireLudoContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID, isActive: true, role: 'responsable' },
  } as never)
  vi.mocked(requireResponsableContext).mockResolvedValue({
    ludo: { id: LUDO_ID },
    member: { id: MEMBER_ID, isActive: true, role: 'responsable' },
  } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(listPublicActivitiesForManagement).mockResolvedValue([activity] as never)
  vi.mocked(listSiteRowsWithOpeningHours).mockResolvedValue([
    { id: SITE_ID, isActive: true },
  ] as never)
  vi.mocked(listPublicActivityRegistrationsForManagement).mockResolvedValue([])
  vi.mocked(updatePublicActivityRegistrationSettings).mockResolvedValue({
    activity,
    changed: true,
  } as never)
  vi.mocked(transitionPublicActivityRegistration).mockResolvedValue({
    registration: { id: '55555555-5555-4555-8555-555555555555' },
    changed: true,
  } as never)
  vi.mocked(createPublicActivity).mockResolvedValue(activity as never)
  vi.mocked(updatePublicActivity).mockResolvedValue(activity as never)
  vi.mocked(getPublicActivity).mockResolvedValue(activity as never)
  vi.mocked(publishPublicActivity).mockResolvedValue({
    activity: { ...activity, status: 'published' },
    changed: true,
    previousStatus: 'draft',
  } as never)
  for (const transition of [archivePublicActivity, trashPublicActivity, restorePublicActivity]) {
    vi.mocked(transition).mockResolvedValue({
      activity,
      changed: true,
      previousLifecycle: 'active',
    } as never)
  }
  vi.mocked(setPublicActivityFeaturedRank).mockResolvedValue(activity as never)
  vi.mocked(authorizePublicActivityMediaScope).mockResolvedValue(scope)
  vi.mocked(setPublicActivityImage).mockResolvedValue({
    activity: { ...activity, imageStorageKey: NEW_PATH },
    previousStorageKey: OLD_PATH,
  } as never)
  vi.mocked(clearPublicActivityImage).mockResolvedValue({
    activity,
    previousStorageKey: OLD_PATH,
  } as never)
  vi.mocked(uploadPublicSiteMedia).mockResolvedValue({
    pathname: NEW_PATH,
    url: 'https://blob.test/new.jpg',
    downloadUrl: 'https://blob.test/new.jpg?download=1',
    contentType: 'image/jpeg',
    size: 4,
  } as never)
  vi.mocked(uploadAndRegisterMedia).mockImplementation(async (input) => {
    const authorized = await input.authorize()
    const blob = await input.upload(authorized)
    try {
      return await input.register(authorized, blob)
    } catch (cause) {
      await input.cleanup(authorized, blob.pathname)
      throw cause
    }
  })
})

describe('gestion des activités publiques', () => {
  it('charge les inscriptions filtrées uniquement pour un responsable', async () => {
    const value = event()
    value.url = new URL(
      `http://local.test?registrationStatus=waitlisted&registrationActivity=${ACTIVITY_ID}`,
    )
    const result = (await load(value as never)) as Record<string, unknown>
    expect(result.canManageRegistrations).toBe(true)
    expect(listPublicActivityRegistrationsForManagement).toHaveBeenCalledWith(
      LUDO_ID,
      'waitlisted',
      ACTIVITY_ID,
    )
  })

  it('ne charge aucune donnée personnelle pour un membre non responsable', async () => {
    vi.mocked(requireLudoContext).mockResolvedValueOnce({
      ludo: { id: LUDO_ID },
      member: { id: MEMBER_ID, isActive: true, role: 'member' },
    } as never)
    const result = (await load(event() as never)) as Record<string, unknown>
    expect(result.canManageRegistrations).toBe(false)
    expect(result.registrations).toEqual([])
    expect(listPublicActivityRegistrationsForManagement).not.toHaveBeenCalled()
  })

  it('réserve réglages et transitions au contexte responsable avec CAS', async () => {
    await actions.registrationSettings!(
      event([
        ['id', ACTIVITY_ID],
        ['revision', '4'],
        ['enabled', 'on'],
        ['capacity', '18'],
      ]) as never,
    )
    expect(requireResponsableContext).toHaveBeenCalled()
    expect(updatePublicActivityRegistrationSettings).toHaveBeenCalledWith(
      ACTIVITY_ID,
      LUDO_ID,
      MEMBER_ID,
      { enabled: true, capacity: 18 },
      4,
    )

    await actions.registrationStatus!(
      event([
        ['id', '55555555-5555-4555-8555-555555555555'],
        ['revision', '2'],
        ['status', 'confirmed'],
      ]) as never,
    )
    expect(transitionPublicActivityRegistration).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      LUDO_ID,
      'confirmed',
      MEMBER_ID,
      2,
    )
  })
  it('charge les activités et tous les lieux du tenant', async () => {
    await expect(load(event() as never)).resolves.toMatchObject({ activities: [activity] })
    expect(listPublicActivitiesForManagement).toHaveBeenCalledWith(LUDO_ID)
    expect(listSiteRowsWithOpeningHours).toHaveBeenCalledWith(LUDO_ID)
  })

  it('bloque la route quand le module public est désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValue(false)
    await expect(load(event() as never)).rejects.toMatchObject({ status: 404 })
    expect(listPublicActivitiesForManagement).not.toHaveBeenCalled()
  })

  it('crée une activité récurrente avec occurrences, exception et ciblage strict', async () => {
    await actions.create!(
      event(
        fields([
          ['targetMode', 'explicit'],
          ['siteIds', SITE_ID],
        ]),
      ) as never,
    )
    expect(createPublicActivity).toHaveBeenCalledWith(
      LUDO_ID,
      MEMBER_ID,
      expect.objectContaining({
        type: 'recurring',
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE;COUNT=52',
        targetMode: 'explicit',
        siteIds: [SITE_ID],
        dates: [
          expect.objectContaining({
            startsAt: new Date('2026-09-02T16:00:00.000Z'),
            endsAt: new Date('2026-09-02T18:00:00.000Z'),
          }),
        ],
        exceptions: [
          expect.objectContaining({
            excludedAt: new Date('2026-09-09T16:00:00.000Z'),
            reason: 'Fermeture',
          }),
        ],
      }),
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_activity.created', actorMemberId: MEMBER_ID }),
    )
  })

  it('convertit aussi une occurrence hivernale selon l’heure murale de Zurich', async () => {
    const winterFields = fields()
      .filter(([name]) => name !== 'dates' && name !== 'exceptions')
      .concat([
        ['targetMode', 'all'],
        ['dates', JSON.stringify([{ startsAt: '2026-01-15T18:00', endsAt: '2026-01-15T20:00' }])],
        ['exceptions', '[]'],
      ])
    await actions.create!(event(winterFields) as never)

    expect(createPublicActivity).toHaveBeenCalledWith(
      LUDO_ID,
      MEMBER_ID,
      expect.objectContaining({
        dates: [
          {
            startsAt: new Date('2026-01-15T17:00:00.000Z'),
            endsAt: new Date('2026-01-15T19:00:00.000Z'),
          },
        ],
      }),
    )
  })

  it.each([
    ['heure inexistante de mars', '2026-03-29T02:30'],
    ['heure ambiguë d’octobre', '2026-10-25T02:30'],
  ])('rejette une %s avant le service métier', async (_label, startsAt) => {
    const invalidFields = fields()
      .filter(([name]) => name !== 'dates' && name !== 'exceptions')
      .concat([
        ['targetMode', 'all'],
        ['dates', JSON.stringify([{ startsAt }])],
        ['exceptions', '[]'],
      ])
    const result = await actions.create!(event(invalidFields) as never)

    expect(result).toMatchObject({ status: 400, data: { error: expect.any(String) } })
    expect(createPublicActivity).not.toHaveBeenCalled()
  })

  it('transmet la révision CAS et conserve le slug publié lorsqu’il est absent', async () => {
    const updateFields = fields([
      ['id', ACTIVITY_ID],
      ['revision', '7'],
      ['targetMode', 'all'],
    ]).filter(([name]) => name !== 'slug')
    await actions.update!(event(updateFields) as never)
    expect(updatePublicActivity).toHaveBeenCalledWith(
      ACTIVITY_ID,
      LUDO_ID,
      expect.objectContaining({ slug: undefined }),
      MEMBER_ID,
      7,
    )
  })

  it('n’audite une publication idempotente que lorsqu’elle change', async () => {
    vi.mocked(publishPublicActivity).mockResolvedValue({
      activity: { ...activity, status: 'published' },
      changed: false,
      previousStatus: 'published',
    } as never)
    await actions.publication!(
      event([
        ['id', ACTIVITY_ID],
        ['revision', '1'],
        ['status', 'published'],
      ]) as never,
    )
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })

  it('gère archive, corbeille et restauration avec des audits explicites', async () => {
    for (const lifecycle of ['archived', 'trashed', 'active']) {
      await actions.lifecycle!(
        event([
          ['id', ACTIVITY_ID],
          ['revision', '1'],
          ['lifecycle', lifecycle],
        ]) as never,
      )
    }
    expect(archivePublicActivity).toHaveBeenCalledWith(ACTIVITY_ID, LUDO_ID, MEMBER_ID, 1)
    expect(trashPublicActivity).toHaveBeenCalledWith(ACTIVITY_ID, LUDO_ID, MEMBER_ID, 1)
    expect(restorePublicActivity).toHaveBeenCalledWith(ACTIVITY_ID, LUDO_ID, MEMBER_ID, 1)
    expect(vi.mocked(emitAuditEvent).mock.calls.map(([input]) => input.action)).toEqual([
      'public_activity.archived',
      'public_activity.trashed',
      'public_activity.restored',
    ])
  })

  it('passe le rang de mise en avant et la révision au service', async () => {
    await actions.feature!(
      event([
        ['id', ACTIVITY_ID],
        ['revision', '4'],
        ['rank', '2'],
      ]) as never,
    )
    expect(setPublicActivityFeaturedRank).toHaveBeenCalledWith(
      ACTIVITY_ID,
      LUDO_ID,
      MEMBER_ID,
      4,
      2,
    )
  })

  it('enregistre une nouvelle image avant de supprimer l’ancienne', async () => {
    const file = new File(['jpeg'], 'activity.jpg', { type: 'image/jpeg' })
    await actions.uploadImage!(
      event([
        ['id', ACTIVITY_ID],
        ['revision', '1'],
        ['file', file],
        ['alt', 'Des joueurs'],
      ]) as never,
    )
    expect(authorizePublicActivityMediaScope).toHaveBeenCalledWith(LUDO_ID, ACTIVITY_ID, 1)
    expect(setPublicActivityImage).toHaveBeenCalledWith(
      LUDO_ID,
      ACTIVITY_ID,
      MEMBER_ID,
      1,
      scope,
      expect.objectContaining({ pathname: NEW_PATH }),
      'Des joueurs',
    )
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD_PATH)
  })

  it('supprime définitivement puis nettoie l’image serveur de l’activité', async () => {
    await actions.delete!(
      event([
        ['id', ACTIVITY_ID],
        ['revision', '3'],
      ]) as never,
    )
    expect(permanentlyDeletePublicActivity).toHaveBeenCalledWith(ACTIVITY_ID, LUDO_ID, 3)
    expect(deletePublicSiteMedia).toHaveBeenCalledWith(scope, OLD_PATH)
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_activity.deleted', entityId: ACTIVITY_ID }),
    )
  })
})
