import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/activity_log.js', () => ({ insertActivity: vi.fn() }))
vi.mock('../db/members.js', () => ({ getActiveResponsables: vi.fn() }))
vi.mock('../db/notifications.js', () => ({
  createNotifications: vi.fn(),
  hasUnreadNotification: vi.fn(),
}))

import { insertActivity } from '../db/activity_log.js'
import { getActiveResponsables } from '../db/members.js'
import { createNotifications, hasUnreadNotification } from '../db/notifications.js'
import { emitEvent } from './events.js'

const LUDO_A = 'ludo-a'
const LUDO_B = 'ludo-b'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(hasUnreadNotification).mockResolvedValue(false)
  vi.mocked(getActiveResponsables).mockResolvedValue([])
})

describe('emitEvent — audit', () => {
  it('écrit toujours une ligne activity_log côté acteur', async () => {
    await emitEvent({
      type: 'theme_request',
      actorLudoId: LUDO_A,
      actorMemberId: 'm-a',
      entityType: 'theme',
      entityId: 't1',
      title: 'x',
      recipientLudoId: LUDO_B,
      metadata: { loanId: 'l1' },
    })
    expect(insertActivity).toHaveBeenCalledWith({
      ludoId: LUDO_A,
      memberId: 'm-a',
      action: 'theme_request',
      entityType: 'theme',
      entityId: 't1',
      metadata: { loanId: 'l1' },
    })
  })
})

describe('emitEvent — fan-out notifications', () => {
  it('crée une notif ludo entière avec la bonne sévérité (action_required)', async () => {
    await emitEvent({
      type: 'theme_request',
      actorLudoId: LUDO_A,
      entityType: 'theme',
      entityId: 't1',
      title: 'Nouvelle demande',
      body: 'corps',
      recipientLudoId: LUDO_B,
    })
    expect(createNotifications).toHaveBeenCalledWith([
      {
        recipientLudoId: LUDO_B,
        recipientMemberId: null,
        type: 'theme_request',
        severity: 'action_required',
        entityType: 'theme',
        entityId: 't1',
        title: 'Nouvelle demande',
        body: 'corps',
      },
    ])
  })

  it('mappe les événements de réponse en sévérité info', async () => {
    await emitEvent({
      type: 'theme_request_confirmed',
      actorLudoId: LUDO_B,
      entityType: 'theme',
      entityId: 't1',
      title: 'Accepté',
      recipientLudoId: LUDO_A,
    })
    const rows = vi.mocked(createNotifications).mock.calls[0][0]
    expect(rows[0].severity).toBe('info')
    expect(rows[0].body).toBeNull()
  })

  it('fan-out vers tous les responsables actifs de la ludo', async () => {
    vi.mocked(getActiveResponsables).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }] as never)
    await emitEvent({
      type: 'absence_request',
      actorLudoId: LUDO_A,
      actorMemberId: 'm-simple',
      entityType: 'absence',
      entityId: 'a1',
      title: 'Demande',
      recipientResponsablesOf: LUDO_A,
    })
    const rows = vi.mocked(createNotifications).mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.recipientMemberId)).toEqual(['r1', 'r2'])
  })

  it('ne se notifie jamais soi-même (acteur exclu du fan-out)', async () => {
    vi.mocked(getActiveResponsables).mockResolvedValue([{ id: 'r1' }, { id: 'm-resp' }] as never)
    await emitEvent({
      type: 'absence_request',
      actorLudoId: LUDO_A,
      actorMemberId: 'm-resp',
      entityType: 'absence',
      entityId: 'a1',
      title: 'Demande',
      recipientResponsablesOf: LUDO_A,
    })
    const rows = vi.mocked(createNotifications).mock.calls[0][0]
    expect(rows).toHaveLength(1)
    expect(rows[0].recipientMemberId).toBe('r1')
  })

  it('idempotence : ne duplique pas une notif déjà non lue (rejeu)', async () => {
    vi.mocked(hasUnreadNotification).mockResolvedValue(true)
    await emitEvent({
      type: 'theme_request',
      actorLudoId: LUDO_A,
      entityType: 'theme',
      entityId: 't1',
      title: 'x',
      recipientLudoId: LUDO_B,
    })
    expect(createNotifications).toHaveBeenCalledWith([])
  })
})

describe('emitEvent — robustesse', () => {
  it("n'échoue jamais même si l'écriture d'audit lève (best-effort)", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(insertActivity).mockRejectedValue(new Error('db down'))
    await expect(
      emitEvent({
        type: 'theme_request',
        actorLudoId: LUDO_A,
        entityType: 'theme',
        entityId: 't1',
        title: 'x',
        recipientLudoId: LUDO_B,
      }),
    ).resolves.toBeUndefined()
  })
})
