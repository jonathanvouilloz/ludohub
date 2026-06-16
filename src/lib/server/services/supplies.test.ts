import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/supplies.js', () => ({
  createSupply: vi.fn(),
  deleteSupply: vi.fn(),
  getSuppliesByLudo: vi.fn(),
  getSupplyById: vi.fn(),
  updateSupply: vi.fn(),
}))

import { createSupply, deleteSupply, getSupplyById, updateSupply } from '../db/supplies.js'
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
})

describe('createSupplyRequest', () => {
  it('crée une demande valide', async () => {
    await createSupplyRequest(LUDO, AUTHOR, {
      name: 'Cartes',
      category: 'fournitures',
      urgency: 'haute',
      notes: '  besoin rapide ',
    })
    expect(createSupply).toHaveBeenCalledWith({
      ludoId: LUDO,
      memberId: AUTHOR,
      name: 'Cartes',
      category: 'fournitures',
      urgency: 'haute',
      notes: 'besoin rapide',
    })
  })

  it('refuse une catégorie invalide', async () => {
    await expect(
      createSupplyRequest(LUDO, AUTHOR, { name: 'X', category: 'nope', urgency: 'normale' }),
    ).rejects.toThrow(/Catégorie invalide/)
  })

  it('refuse une urgence invalide', async () => {
    await expect(
      createSupplyRequest(LUDO, AUTHOR, { name: 'X', category: 'autre', urgency: 'extreme' }),
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
