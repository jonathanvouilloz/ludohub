import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => vi.fn())
const list = vi.hoisted(() => vi.fn())
const transition = vi.hoisted(() => vi.fn())
const settings = vi.hoisted(() => vi.fn())
vi.mock('$lib/server/ludo-context.js', () => ({ requireResponsableContext: auth }))
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
    listPublicActivityRegistrationsForManagement: list,
    transitionPublicActivityRegistration: transition,
    updatePublicActivityRegistrationSettings: settings,
  }
})
import { GET, PATCH } from './+server.js'

const LUDO_ID = '10000000-0000-4000-8000-000000000001'
const MEMBER_ID = '20000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue({ ludo: { id: LUDO_ID }, member: { id: MEMBER_ID } })
  list.mockResolvedValue([])
  transition.mockResolvedValue({ registration: { id: 'registration-a' }, changed: true })
  settings.mockResolvedValue({ activity: { id: 'activity-a' }, changed: true })
})

describe('gestion interne des inscriptions', () => {
  it('authentifie un responsable et scope les filtres au tenant', async () => {
    const url = new URL(
      'https://app.test/api/internal/demo/activity-registrations?status=waitlisted&activityId=a&limit=20',
    )
    const response = await GET({ params: { ludo: 'demo' }, url } as never)
    expect(response.status).toBe(200)
    expect(auth).toHaveBeenCalled()
    expect(list).toHaveBeenCalledWith(LUDO_ID, 'waitlisted', 'a', 20)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('transmet le changement de statut avec CAS et identité du responsable', async () => {
    const request = new Request('https://app.test/api/internal/demo/activity-registrations', {
      method: 'PATCH',
      body: JSON.stringify({
        kind: 'status',
        id: 'registration-a',
        status: 'confirmed',
        revision: 3,
      }),
    })
    await PATCH({ params: { ludo: 'demo' }, request } as never)
    expect(transition).toHaveBeenCalledWith('registration-a', LUDO_ID, 'confirmed', MEMBER_ID, 3)
  })

  it('transmet les réglages de capacité avec CAS', async () => {
    const request = new Request('https://app.test/api/internal/demo/activity-registrations', {
      method: 'PATCH',
      body: JSON.stringify({
        kind: 'settings',
        activityId: 'activity-a',
        enabled: true,
        capacity: 18,
        revision: 4,
      }),
    })
    await PATCH({ params: { ludo: 'demo' }, request } as never)
    expect(settings).toHaveBeenCalledWith(
      'activity-a',
      LUDO_ID,
      MEMBER_ID,
      { enabled: true, capacity: 18 },
      4,
    )
  })
})
