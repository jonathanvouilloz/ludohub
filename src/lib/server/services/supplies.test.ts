import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/supplies.js', () => ({
  createSupply: vi.fn(),
  deleteSupply: vi.fn(),
  getSuppliesByLudo: vi.fn(),
  getSupplyById: vi.fn(),
  updateSupply: vi.fn(),
}))

vi.mock('./events.js', () => ({
  emitEvent: vi.fn(),
}))

import { createSupply, deleteSupply, getSupplyById, updateSupply } from '../db/supplies.js'
import { emitEvent } from './events.js'
import {
  createSupplyRequest,
  deleteSupplyRequest,
  SupplyServiceError,
  updateSupplyStatus,
} from './supplies.js'

const LUDO = 'ludo-a'
const SUPPLY = 'supply-1'
const AUTHOR = 'member-1'

const author = { id: AUTHOR, role: 'member' } as never
const otherMember = { id: 'member-2', role: 'member' } as never
const responsable = { id: 'member-9', role: 'responsable' } as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupplyById).mockResolvedValue({
    id: SUPPLY,
    ludoId: LUDO,
    memberId: AUTHOR,
  } as never)
  vi.mocked(createSupply).mockResolvedValue({
    id: SUPPLY,
    ludoId: LUDO,
    memberId: AUTHOR,
    name: 'Cartes',
  } as never)
})

describe('createSupplyRequest', () => {
  it('crée une demande valide', async () => {
    await createSupplyRequest(LUDO, AUTHOR, {
      name: 'Cartes',
      urgency: 'haute',
      notes: '  besoin rapide ',
    })
    expect(createSupply).toHaveBeenCalledWith({
      ludoId: LUDO,
      memberId: AUTHOR,
      name: 'Cartes',
      link: null,
      urgency: 'haute',
      notes: 'besoin rapide',
    })
  })

  it('notifie les responsables de la ludo', async () => {
    await createSupplyRequest(LUDO, AUTHOR, { name: 'Cartes', urgency: 'haute' })
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'supply_request',
        actorLudoId: LUDO,
        actorMemberId: AUTHOR,
        entityType: 'supply',
        entityId: SUPPLY,
        recipientResponsablesOf: LUDO,
      }),
    )
  })

  it('conserve un lien http(s) valide', async () => {
    await createSupplyRequest(LUDO, AUTHOR, {
      name: 'Cartes',
      link: 'https://example.com/cartes',
      urgency: 'normale',
    })
    expect(createSupply).toHaveBeenCalledWith(
      expect.objectContaining({ link: 'https://example.com/cartes' }),
    )
  })

  it('refuse un lien non http', async () => {
    await expect(
      createSupplyRequest(LUDO, AUTHOR, { name: 'X', link: 'ftp://x', urgency: 'normale' }),
    ).rejects.toThrow(/http/)
  })

  it('refuse une urgence invalide', async () => {
    await expect(
      createSupplyRequest(LUDO, AUTHOR, { name: 'X', urgency: 'extreme' }),
    ).rejects.toThrow(/Urgence invalide/)
  })
})

describe('updateSupplyStatus', () => {
  it('met à jour un statut valide', async () => {
    await updateSupplyStatus(SUPPLY, LUDO, 'commande')
    expect(updateSupply).toHaveBeenCalledWith(SUPPLY, { status: 'commande' })
  })

  it('refuse un statut invalide', async () => {
    await expect(updateSupplyStatus(SUPPLY, LUDO, 'parti')).rejects.toThrow(/Statut invalide/)
  })
})

describe('deleteSupplyRequest', () => {
  it('autorise l’auteur·e', async () => {
    await deleteSupplyRequest(SUPPLY, LUDO, author)
    expect(deleteSupply).toHaveBeenCalledWith(SUPPLY)
  })

  it('autorise un·e responsable', async () => {
    await deleteSupplyRequest(SUPPLY, LUDO, responsable)
    expect(deleteSupply).toHaveBeenCalledWith(SUPPLY)
  })

  it('refuse un autre membre simple', async () => {
    await expect(deleteSupplyRequest(SUPPLY, LUDO, otherMember)).rejects.toThrow(SupplyServiceError)
    expect(deleteSupply).not.toHaveBeenCalled()
  })
})
