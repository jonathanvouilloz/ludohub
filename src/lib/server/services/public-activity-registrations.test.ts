import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const db = vi.hoisted(() => ({
  getByKey: vi.fn(),
  getAvailability: vi.fn(),
  getForLudo: vi.fn(),
  insert: vi.fn(),
  list: vi.fn(),
  transition: vi.fn(),
  updateSettings: vi.fn(),
}))
const getLudoBySlug = vi.hoisted(() => vi.fn())
const getActivity = vi.hoisted(() => vi.fn())
const getVisibleActivity = vi.hoisted(() => vi.fn())
const isPublicSiteEnabled = vi.hoisted(() => vi.fn())
const emitAuditEvent = vi.hoisted(() => vi.fn())

vi.mock('../db/ludotheques.js', () => ({ getLudoBySlug }))
vi.mock('../db/public-activities.js', () => ({ getPublicActivityRowForLudo: getActivity }))
vi.mock('../db/public-activity-registrations.js', () => ({
  getPublicActivityRegistrationAvailabilityRow: db.getAvailability,
  getPublicActivityRegistrationByIdempotency: db.getByKey,
  getPublicActivityRegistrationRowForLudo: db.getForLudo,
  insertPublicActivityRegistrationAtomic: db.insert,
  listPublicActivityRegistrationRows: db.list,
  transitionPublicActivityRegistrationRow: db.transition,
  updatePublicActivityRegistrationSettingsRow: db.updateSettings,
}))
vi.mock('./public-activities.js', () => ({ getVisiblePublicActivityBySlug: getVisibleActivity }))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled }))
vi.mock('./events.js', () => ({ emitAuditEvent }))

import {
  ACTIVITY_WAITLIST_MESSAGE,
  getPublicActivityRegistrationAvailability,
  listPublicActivityRegistrationsForManagement,
  submitPublicActivityRegistrationByLudoSlug,
  transitionPublicActivityRegistration,
  updatePublicActivityRegistrationSettings,
} from './public-activity-registrations.js'

const LUDO_ID = '10000000-0000-4000-8000-000000000001'
const ACTIVITY_ID = '20000000-0000-4000-8000-000000000001'
const REGISTRATION_ID = '30000000-0000-4000-8000-000000000001'
const MEMBER_ID = '40000000-0000-4000-8000-000000000001'
const input = {
  contactName: 'Ada Lovelace',
  email: 'ADA@EXAMPLE.CH',
  phone: '+41 22 000 00 00',
  participantCount: 2,
  message: 'Deux enfants',
}
function fingerprint(activitySlug = 'atelier', value = input) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        activitySlug,
        contactName: value.contactName.trim(),
        email: value.email.trim().toLowerCase(),
        phone: value.phone?.trim() || null,
        participantCount: value.participantCount,
        message: value.message?.trim() || null,
      }),
    )
    .digest('hex')
}

beforeEach(() => {
  vi.clearAllMocks()
  getLudoBySlug.mockResolvedValue({ id: LUDO_ID, slug: 'demo' })
  isPublicSiteEnabled.mockResolvedValue(true)
  getVisibleActivity.mockResolvedValue({
    id: ACTIVITY_ID,
    lifecycle: 'active',
    registrationEnabled: true,
  })
  db.getByKey.mockResolvedValue(undefined)
  db.insert.mockResolvedValue({ id: REGISTRATION_ID, receipt_status: 'received' })
})

describe('inscription publique à une activité', () => {
  it('normalise et stocke dans le tenant, sans renvoyer de donnée personnelle', async () => {
    const result = await submitPublicActivityRegistrationByLudoSlug(
      'demo',
      'atelier',
      'request-00000001',
      input,
    )
    expect(result).toEqual({
      receiptId: REGISTRATION_ID,
      status: 'received',
      message: 'Votre inscription a bien été reçue.',
      created: true,
    })
    expect(JSON.stringify(result)).not.toContain('Ada')
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ludoId: LUDO_ID,
        activityId: ACTIVITY_ID,
        email: 'ada@example.ch',
        participantCount: 2,
        idempotencyKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        requestFingerprint: fingerprint(),
      }),
    )
  })

  it('garde le formulaire accessible et renvoie la phrase stable en liste d’attente', async () => {
    db.insert.mockResolvedValueOnce({ id: REGISTRATION_ID, receipt_status: 'waitlisted' })
    await expect(
      submitPublicActivityRegistrationByLudoSlug('demo', 'atelier', 'request-00000001', input),
    ).resolves.toMatchObject({ status: 'waitlisted', message: ACTIVITY_WAITLIST_MESSAGE })
  })

  it('rejoue la même réponse sans nouvelle écriture', async () => {
    db.getByKey.mockResolvedValueOnce({
      id: REGISTRATION_ID,
      status: 'confirmed',
      receiptStatus: 'waitlisted',
      requestFingerprint: fingerprint(),
    })
    const result = await submitPublicActivityRegistrationByLudoSlug(
      'demo',
      'atelier',
      'request-00000001',
      input,
    )
    expect(result).toMatchObject({
      receiptId: REGISTRATION_ID,
      status: 'waitlisted',
      created: false,
    })
    expect(db.insert).not.toHaveBeenCalled()
    expect(isPublicSiteEnabled).not.toHaveBeenCalled()
    expect(getVisibleActivity).not.toHaveBeenCalled()
  })

  it.each([
    ['autre-atelier', input],
    ['atelier', { ...input, participantCount: 3 }],
  ])('refuse le rejeu de la clé avec une autre demande', async (slug, changedInput) => {
    db.getByKey.mockResolvedValueOnce({
      id: REGISTRATION_ID,
      receiptStatus: 'received',
      requestFingerprint: fingerprint(),
    })
    await expect(
      submitPublicActivityRegistrationByLudoSlug('demo', slug, 'request-00000001', changedInput),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('compare aussi le fingerprint après une course sur la contrainte unique', async () => {
    db.insert.mockResolvedValueOnce(undefined)
    db.getByKey.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      id: REGISTRATION_ID,
      receiptStatus: 'received',
      requestFingerprint: fingerprint('autre-atelier'),
    })
    await expect(
      submitPublicActivityRegistrationByLudoSlug('demo', 'atelier', 'request-00000001', input),
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it.each([0, 1.5, 51])('rejette un nombre de participants hors bornes: %s', async (count) => {
    await expect(
      submitPublicActivityRegistrationByLudoSlug('demo', 'atelier', 'request-00000001', {
        ...input,
        participantCount: count,
      }),
    ).rejects.toMatchObject({ code: 'invalid' })
  })

  it('ne révèle pas une activité désactivée', async () => {
    getVisibleActivity.mockResolvedValueOnce({
      id: ACTIVITY_ID,
      lifecycle: 'active',
      registrationEnabled: false,
    })
    await expect(
      submitPublicActivityRegistrationByLudoSlug('demo', 'atelier', 'request-00000001', input),
    ).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('projection de capacité', () => {
  it('ne publie la phrase que lorsque la capacité est atteinte', async () => {
    db.getAvailability.mockResolvedValueOnce({ enabled: true, capacity: 10, occupied: 10 })
    await expect(getPublicActivityRegistrationAvailability(ACTIVITY_ID, LUDO_ID)).resolves.toEqual({
      enabled: true,
      capacity: 10,
      isAtCapacity: true,
      fullMessage: ACTIVITY_WAITLIST_MESSAGE,
    })
    db.getAvailability.mockResolvedValueOnce({ enabled: true, capacity: 10, occupied: 9 })
    await expect(getPublicActivityRegistrationAvailability(ACTIVITY_ID, LUDO_ID)).resolves.toEqual({
      enabled: true,
      capacity: 10,
      isAtCapacity: false,
      fullMessage: null,
    })
  })
})

describe('gestion interne tenant-scopée', () => {
  it('retourne un DTO whitelist sans secrets membre, outbox ou champs éditoriaux', async () => {
    db.list.mockResolvedValueOnce([
      {
        id: REGISTRATION_ID,
        activityId: ACTIVITY_ID,
        contactName: 'Ada',
        email: 'ada@example.ch',
        phone: null,
        participantCount: 2,
        message: null,
        status: 'received',
        revision: 1,
        handledAt: null,
        archivedAt: null,
        createdAt: new Date('2026-08-05T12:00:00Z'),
        updatedAt: new Date('2026-08-05T12:00:00Z'),
        idempotencyKeyHash: 'secret-hash',
        handledBy: { id: MEMBER_ID, passwordHash: 'secret', passwordVersion: 9 },
        outbox: [{ recipientEmail: 'ada@example.ch', lastErrorCode: 'smtp-secret' }],
        activity: {
          id: ACTIVITY_ID,
          title: 'Atelier',
          slug: 'atelier',
          imageStorageKey: 'private/storage/key',
          author: { passwordHash: 'secret' },
        },
      },
    ])
    const result = await listPublicActivityRegistrationsForManagement(LUDO_ID)
    expect(result[0]?.activity).toEqual({ id: ACTIVITY_ID, title: 'Atelier', slug: 'atelier' })
    expect(JSON.stringify(result)).not.toMatch(
      /passwordHash|passwordVersion|recipientEmail|lastErrorCode|idempotencyKeyHash|imageStorageKey|author/,
    )
  })

  it('applique le CAS et audite une transition sans donnée personnelle', async () => {
    db.getForLudo
      .mockResolvedValueOnce({
        id: REGISTRATION_ID,
        ludoId: LUDO_ID,
        status: 'received',
        revision: 2,
        activity: { id: ACTIVITY_ID, title: 'Atelier', slug: 'atelier' },
      })
      .mockResolvedValueOnce({
        id: REGISTRATION_ID,
        ludoId: LUDO_ID,
        status: 'confirmed',
        revision: 3,
        activity: { id: ACTIVITY_ID, title: 'Atelier', slug: 'atelier' },
      })
    db.transition.mockResolvedValue({ id: REGISTRATION_ID })
    await transitionPublicActivityRegistration(REGISTRATION_ID, LUDO_ID, 'confirmed', MEMBER_ID, 2)
    expect(db.transition).toHaveBeenCalledWith(
      REGISTRATION_ID,
      LUDO_ID,
      'received',
      2,
      expect.objectContaining({ status: 'confirmed', handledByMemberId: MEMBER_ID }),
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { from: 'received', to: 'confirmed' } }),
    )
    expect(JSON.stringify(emitAuditEvent.mock.calls)).not.toMatch(/Ada|example\.ch|Deux enfants/)
  })

  it('met à jour les réglages avec la révision de l’activité', async () => {
    getActivity
      .mockResolvedValueOnce({
        id: ACTIVITY_ID,
        ludoId: LUDO_ID,
        revision: 4,
        registrationEnabled: false,
        registrationCapacity: null,
      })
      .mockResolvedValueOnce({ id: ACTIVITY_ID, revision: 5 })
    db.updateSettings.mockResolvedValue({ id: ACTIVITY_ID })
    await updatePublicActivityRegistrationSettings(
      ACTIVITY_ID,
      LUDO_ID,
      MEMBER_ID,
      { enabled: true, capacity: 24 },
      4,
    )
    expect(db.updateSettings).toHaveBeenCalledWith(
      ACTIVITY_ID,
      LUDO_ID,
      4,
      true,
      24,
      MEMBER_ID,
      expect.any(Date),
    )
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { registrationEnabled: true, registrationCapacity: 24 },
      }),
    )
  })
})
