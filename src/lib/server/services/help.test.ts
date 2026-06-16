import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/help.js', () => ({
  createHelpRequest: vi.fn(),
  createResponse: vi.fn(),
  getHelpRequestById: vi.fn(),
  getOpenRequests: vi.fn(),
  getPastRequestsForLudo: vi.fn(),
  getResponseById: vi.fn(),
  hasMemberResponded: vi.fn(),
  refuseOtherResponses: vi.fn(),
  setRequestStatus: vi.fn(),
  setResponseStatus: vi.fn(),
}))
vi.mock('./events.js', () => ({ emitEvent: vi.fn() }))

import {
  createHelpRequest,
  createResponse,
  getHelpRequestById,
  getResponseById,
  hasMemberResponded,
  refuseOtherResponses,
  setRequestStatus,
  setResponseStatus,
} from '../db/help.js'
import {
  cancelRequest,
  confirmVolunteer,
  publishHelpRequest,
  respondToRequest,
  HelpServiceError,
} from './help.js'

const LUDO_A = 'ludo-a'
const LUDO_B = 'ludo-b'
const REQUEST = 'req-1'
const MEMBER_B = 'member-b'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getHelpRequestById).mockResolvedValue({
    id: REQUEST,
    ludoId: LUDO_A,
    status: 'ouverte',
  } as never)
  vi.mocked(hasMemberResponded).mockResolvedValue(false)
  vi.mocked(createResponse).mockResolvedValue({ id: 'resp-1' } as never)
})

describe('publishHelpRequest', () => {
  it('crée une demande avec date + champs nettoyés', async () => {
    await publishHelpRequest(LUDO_A, { date: '2026-07-04', slotInfo: ' samedi ', notes: '' })
    expect(createHelpRequest).toHaveBeenCalledWith({
      ludoId: LUDO_A,
      date: '2026-07-04',
      slotInfo: 'samedi',
      notes: null,
    })
  })

  it('refuse une date vide', async () => {
    await expect(publishHelpRequest(LUDO_A, { date: '  ' })).rejects.toThrow(/date/i)
    expect(createHelpRequest).not.toHaveBeenCalled()
  })
})

describe('respondToRequest', () => {
  it('enregistre une réponse d’une autre ludo', async () => {
    await respondToRequest(REQUEST, MEMBER_B, LUDO_B)
    expect(createResponse).toHaveBeenCalledWith({
      helpRequestId: REQUEST,
      memberId: MEMBER_B,
      ludoId: LUDO_B,
    })
  })

  it('refuse de répondre à une demande de sa propre ludo', async () => {
    await expect(respondToRequest(REQUEST, 'member-a', LUDO_A)).rejects.toThrow(/propre/)
    expect(createResponse).not.toHaveBeenCalled()
  })

  it('refuse une demande qui n’est plus ouverte', async () => {
    vi.mocked(getHelpRequestById).mockResolvedValue({
      id: REQUEST,
      ludoId: LUDO_A,
      status: 'pourvue',
    } as never)
    await expect(respondToRequest(REQUEST, MEMBER_B, LUDO_B)).rejects.toThrow(/ouverte/)
  })

  it('refuse une double réponse du même membre', async () => {
    vi.mocked(hasMemberResponded).mockResolvedValue(true)
    await expect(respondToRequest(REQUEST, MEMBER_B, LUDO_B)).rejects.toThrow(/déjà répondu/)
    expect(createResponse).not.toHaveBeenCalled()
  })
})

describe('confirmVolunteer', () => {
  beforeEach(() => {
    vi.mocked(getResponseById).mockResolvedValue({
      id: 'resp-1',
      helpRequestId: REQUEST,
    } as never)
  })

  it('confirme le volontaire, refuse les autres, marque pourvue', async () => {
    await confirmVolunteer(REQUEST, 'resp-1', LUDO_A)
    expect(setResponseStatus).toHaveBeenCalledWith('resp-1', 'confirme')
    expect(refuseOtherResponses).toHaveBeenCalledWith(REQUEST, 'resp-1')
    expect(setRequestStatus).toHaveBeenCalledWith(REQUEST, 'pourvue')
  })

  it('refuse si la demande appartient à une autre ludo', async () => {
    await expect(confirmVolunteer(REQUEST, 'resp-1', LUDO_B)).rejects.toThrow(HelpServiceError)
    expect(setRequestStatus).not.toHaveBeenCalled()
  })

  it('refuse si la réponse n’est pas rattachée à la demande', async () => {
    vi.mocked(getResponseById).mockResolvedValue({
      id: 'resp-1',
      helpRequestId: 'autre-req',
    } as never)
    await expect(confirmVolunteer(REQUEST, 'resp-1', LUDO_A)).rejects.toThrow(/Volontaire/)
  })
})

describe('cancelRequest', () => {
  it('annule une demande ouverte de la ludo', async () => {
    await cancelRequest(REQUEST, LUDO_A)
    expect(setRequestStatus).toHaveBeenCalledWith(REQUEST, 'annulee')
  })

  it('refuse l’annulation par une autre ludo', async () => {
    await expect(cancelRequest(REQUEST, LUDO_B)).rejects.toThrow(HelpServiceError)
    expect(setRequestStatus).not.toHaveBeenCalled()
  })
})
