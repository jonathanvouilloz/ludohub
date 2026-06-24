import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/eventTypes.js', () => ({
  listEventTypes: vi.fn(),
  getEventTypeById: vi.fn(),
  createEventType: vi.fn(),
  updateEventType: vi.fn(),
  deleteEventType: vi.fn(),
}))

import {
  createEventType,
  deleteEventType,
  getEventTypeById,
  updateEventType,
} from '../db/eventTypes.js'
import {
  archiveType,
  createType,
  deleteType,
  EventTypeServiceError,
  renameType,
} from './eventTypes.js'

const LUDO = 'ludo-a'
const OTHER = 'ludo-b'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createEventType).mockResolvedValue({ id: 't-1', ludoId: LUDO, name: 'Soirée' } as never)
  vi.mocked(getEventTypeById).mockResolvedValue({
    id: 't-1',
    ludoId: LUDO,
    name: 'Soirée',
  } as never)
})

describe('createType', () => {
  it('crée un type avec un nom nettoyé', async () => {
    await createType(LUDO, { name: '  Soirée jeux  ' })
    expect(createEventType).toHaveBeenCalledWith({ ludoId: LUDO, name: 'Soirée jeux' })
  })

  it('refuse un nom vide', async () => {
    await expect(createType(LUDO, { name: '   ' })).rejects.toThrow(EventTypeServiceError)
    expect(createEventType).not.toHaveBeenCalled()
  })

  it('mappe une violation d’unicité Postgres (23505) en erreur métier', async () => {
    vi.mocked(createEventType).mockRejectedValue({ code: '23505' })
    await expect(createType(LUDO, { name: 'Doublon' })).rejects.toThrow(/existe déjà/)
  })
})

describe('renameType', () => {
  it('refuse un type d’une autre ludo', async () => {
    vi.mocked(getEventTypeById).mockResolvedValue({ id: 't-1', ludoId: OTHER } as never)
    await expect(renameType('t-1', LUDO, { name: 'X' })).rejects.toThrow(EventTypeServiceError)
    expect(updateEventType).not.toHaveBeenCalled()
  })
})

describe('archiveType', () => {
  it('archive un type de la ludo', async () => {
    await archiveType('t-1', LUDO, true)
    expect(updateEventType).toHaveBeenCalledWith('t-1', { isArchived: true })
  })
})

describe('deleteType', () => {
  it('supprime un type de la ludo', async () => {
    await deleteType('t-1', LUDO)
    expect(deleteEventType).toHaveBeenCalledWith('t-1')
  })

  it('refuse un type d’une autre ludo', async () => {
    vi.mocked(getEventTypeById).mockResolvedValue({ id: 't-1', ludoId: OTHER } as never)
    await expect(deleteType('t-1', LUDO)).rejects.toThrow(EventTypeServiceError)
    expect(deleteEventType).not.toHaveBeenCalled()
  })
})
