import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/wishes.js', () => ({
  createWish: vi.fn(),
  deleteWish: vi.fn(),
  getWishById: vi.fn(),
  getWishesByLudo: vi.fn(),
  updateWish: vi.fn(),
}))

import { createWish, deleteWish, getWishById, updateWish } from '../db/wishes.js'
import { createGameWish, deleteGameWish, setBought, WishServiceError } from './wishes.js'

const LUDO = 'ludo-a'
const WISH = 'wish-1'
const AUTHOR = 'member-author'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getWishById).mockResolvedValue({ id: WISH, ludoId: LUDO } as never)
})

describe('createGameWish', () => {
  it('crée un souhait minimal (titre seul)', async () => {
    await createGameWish(LUDO, { title: 'Catan' }, AUTHOR)
    expect(createWish).toHaveBeenCalledWith({
      ludoId: LUDO,
      title: 'Catan',
      link: null,
      priceChf: null,
      addedById: AUTHOR,
    })
  })

  it('convertit le prix CHF en centimes', async () => {
    await createGameWish(LUDO, { title: 'Catan', priceChf: '12.50' }, AUTHOR)
    expect(createWish).toHaveBeenCalledWith(expect.objectContaining({ priceChf: 1250 }))
  })

  it('accepte une virgule décimale', async () => {
    await createGameWish(LUDO, { title: 'Catan', priceChf: '9,90' }, AUTHOR)
    expect(createWish).toHaveBeenCalledWith(expect.objectContaining({ priceChf: 990 }))
  })

  it('refuse un titre vide', async () => {
    await expect(createGameWish(LUDO, { title: '  ' }, AUTHOR)).rejects.toThrow(/titre est requis/)
  })

  it('refuse un lien non http', async () => {
    await expect(createGameWish(LUDO, { title: 'X', link: 'ftp://x' }, AUTHOR)).rejects.toThrow(
      /http/,
    )
  })

  it('refuse un prix négatif', async () => {
    await expect(createGameWish(LUDO, { title: 'X', priceChf: '-5' }, AUTHOR)).rejects.toThrow(
      WishServiceError,
    )
  })
})

describe('setBought', () => {
  it('marque acheté avec le buyer', async () => {
    await setBought(WISH, LUDO, 'member-1')
    expect(updateWish).toHaveBeenCalledWith(WISH, { status: 'achete', buyerId: 'member-1' })
  })

  it('refuse un souhait d’une autre ludo', async () => {
    vi.mocked(getWishById).mockResolvedValue({ id: WISH, ludoId: 'autre' } as never)
    await expect(setBought(WISH, LUDO, 'm')).rejects.toThrow(WishServiceError)
  })
})

describe('deleteGameWish', () => {
  it('supprime un souhait de la ludo', async () => {
    await deleteGameWish(WISH, LUDO)
    expect(deleteWish).toHaveBeenCalledWith(WISH)
  })
})
