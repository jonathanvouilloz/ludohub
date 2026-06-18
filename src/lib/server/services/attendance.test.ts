import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/attendance.js', () => ({
  insertRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
  getRecordById: vi.fn(),
  listByMonth: vi.fn(),
  existsForSlot: vi.fn(),
}))

import {
  deleteRecord,
  existsForSlot,
  getRecordById,
  insertRecord,
  listByMonth,
  updateRecord,
} from '../db/attendance.js'
import {
  AttendanceServiceError,
  deleteSession,
  getMonthSummary,
  recordSession,
  updateSession,
  type SessionInput,
} from './attendance.js'

const LUDO = 'ludo-a'
const MEMBER = 'member-1'
const RECORD = 'rec-1'

function input(overrides: Partial<SessionInput> = {}): SessionInput {
  return {
    date: '2026-06-18',
    period: 'matin',
    eventLabel: '',
    adultsCount: 3,
    childrenCount: 5,
    loansCount: 2,
    returnsCount: 1,
    weather: 'beau',
    temperature: 24,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(existsForSlot).mockResolvedValue(false)
  vi.mocked(insertRecord).mockResolvedValue({ id: RECORD, ludoId: LUDO } as never)
  vi.mocked(updateRecord).mockResolvedValue({ id: RECORD, ludoId: LUDO } as never)
  vi.mocked(getRecordById).mockResolvedValue({ id: RECORD, ludoId: LUDO } as never)
})

describe('recordSession', () => {
  it('clôture une séance valide', async () => {
    await recordSession(LUDO, MEMBER, input())
    expect(insertRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        ludoId: LUDO,
        closedByMemberId: MEMBER,
        period: 'matin',
        eventLabel: null,
        adultsCount: 3,
        weather: 'beau',
        temperature: 24,
      }),
    )
  })

  it('refuse un doublon (date, matin)', async () => {
    vi.mocked(existsForSlot).mockResolvedValue(true)
    await expect(recordSession(LUDO, MEMBER, input({ period: 'matin' }))).rejects.toThrow(
      AttendanceServiceError,
    )
    expect(insertRecord).not.toHaveBeenCalled()
  })

  it('autorise deux événements le même jour (pas de contrôle de doublon)', async () => {
    await recordSession(LUDO, MEMBER, input({ period: 'evenement', eventLabel: 'Soirée jeux' }))
    await recordSession(LUDO, MEMBER, input({ period: 'evenement', eventLabel: 'Parascolaire' }))
    expect(existsForSlot).not.toHaveBeenCalled()
    expect(insertRecord).toHaveBeenCalledTimes(2)
  })

  it('exige un libellé pour un événement', async () => {
    await expect(
      recordSession(LUDO, MEMBER, input({ period: 'evenement', eventLabel: '  ' })),
    ).rejects.toThrow(/libellé/i)
  })

  it('force eventLabel à null pour matin/apres_midi', async () => {
    await recordSession(LUDO, MEMBER, input({ period: 'apres_midi', eventLabel: 'ignoré' }))
    expect(insertRecord).toHaveBeenCalledWith(expect.objectContaining({ eventLabel: null }))
  })

  it('refuse un compteur négatif', async () => {
    await expect(recordSession(LUDO, MEMBER, input({ adultsCount: -1 }))).rejects.toThrow(
      AttendanceServiceError,
    )
  })

  it('accepte une météo/température vides (null)', async () => {
    await recordSession(LUDO, MEMBER, input({ weather: null, temperature: null }))
    expect(insertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ weather: null, temperature: null }),
    )
  })

  it('accepte une température négative', async () => {
    await recordSession(LUDO, MEMBER, input({ temperature: -4 }))
    expect(insertRecord).toHaveBeenCalledWith(expect.objectContaining({ temperature: -4 }))
  })
})

describe('updateSession', () => {
  it('refuse une séance d’un autre ludo', async () => {
    vi.mocked(getRecordById).mockResolvedValue({ id: RECORD, ludoId: 'ludo-b' } as never)
    await expect(updateSession(RECORD, LUDO, input())).rejects.toThrow(AttendanceServiceError)
    expect(updateRecord).not.toHaveBeenCalled()
  })

  it('ignore la séance courante dans le contrôle de doublon', async () => {
    await updateSession(RECORD, LUDO, input())
    expect(existsForSlot).toHaveBeenCalledWith(LUDO, '2026-06-18', 'matin', RECORD)
  })
})

describe('deleteSession', () => {
  it('supprime une séance du ludo', async () => {
    await deleteSession(RECORD, LUDO)
    expect(deleteRecord).toHaveBeenCalledWith(RECORD)
  })

  it('refuse une séance d’un autre ludo', async () => {
    vi.mocked(getRecordById).mockResolvedValue({ id: RECORD, ludoId: 'ludo-b' } as never)
    await expect(deleteSession(RECORD, LUDO)).rejects.toThrow(AttendanceServiceError)
    expect(deleteRecord).not.toHaveBeenCalled()
  })
})

describe('getMonthSummary', () => {
  it('agrège les totaux du mois', async () => {
    vi.mocked(listByMonth).mockResolvedValue([
      { adultsCount: 3, childrenCount: 5, loansCount: 2, returnsCount: 1 },
      { adultsCount: 4, childrenCount: 1, loansCount: 0, returnsCount: 6 },
    ] as never)
    const { totals } = await getMonthSummary(LUDO, 2026, 6)
    expect(totals).toEqual({
      adultsCount: 7,
      childrenCount: 6,
      loansCount: 2,
      returnsCount: 7,
    })
  })
})
