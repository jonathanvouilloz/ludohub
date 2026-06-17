import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/ludotheques.js', () => ({
  createLudo: vi.fn(),
  getAllLudos: vi.fn(),
  getLudoById: vi.fn(),
  getLudoBySlug: vi.fn(),
  updateLudoById: vi.fn(),
}))

vi.mock('../db/activity_log.js', () => ({
  getGlobalActivityLog: vi.fn(),
}))

vi.mock('./auth.js', () => ({
  hashLudoPassword: vi.fn(async (pw: string) => `hash:${pw}`),
}))

import { createLudo, getLudoById, getLudoBySlug, updateLudoById } from '../db/ludotheques.js'
import {
  AdminServiceError,
  createLudotheque,
  resetLudoPassword,
  updateLudotheque,
} from './admin.js'

const LUDO = 'ludo-1'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getLudoBySlug).mockResolvedValue(undefined)
  vi.mocked(getLudoById).mockResolvedValue({ id: LUDO } as never)
})

describe('createLudotheque', () => {
  it('crée une ludo avec slug dérivé du nom et mot de passe haché', async () => {
    await createLudotheque({ name: 'Ludothèque des Pâquis', color: '#C0007A', password: 'secret1' })
    expect(createLudo).toHaveBeenCalledWith({
      name: 'Ludothèque des Pâquis',
      slug: 'ludotheque-des-paquis',
      color: '#c0007a',
      passwordHash: 'hash:secret1',
      address: null,
    })
  })

  it('respecte un slug fourni explicitement', async () => {
    await createLudotheque({
      name: 'Ludo X',
      slug: 'Mon Slug Custom',
      color: '#000000',
      password: 'secret1',
    })
    expect(createLudo).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mon-slug-custom' }))
  })

  it('refuse un slug déjà utilisé', async () => {
    vi.mocked(getLudoBySlug).mockResolvedValue({ id: 'other' } as never)
    await expect(
      createLudotheque({ name: 'Paquis', color: '#000000', password: 'secret1' }),
    ).rejects.toThrow(AdminServiceError)
    expect(createLudo).not.toHaveBeenCalled()
  })

  it('refuse une couleur invalide', async () => {
    await expect(
      createLudotheque({ name: 'X', color: 'rouge', password: 'secret1' }),
    ).rejects.toThrow(/Couleur invalide/)
  })

  it('refuse un mot de passe trop court', async () => {
    await expect(
      createLudotheque({ name: 'X', color: '#000000', password: '123' }),
    ).rejects.toThrow(/au moins 6/)
  })
})

describe('updateLudotheque', () => {
  it('met à jour les champs fournis uniquement', async () => {
    await updateLudotheque(LUDO, { color: '#ABCDEF' })
    expect(updateLudoById).toHaveBeenCalledWith(LUDO, { color: '#abcdef' })
  })

  it('échoue si la ludo est introuvable', async () => {
    vi.mocked(getLudoById).mockResolvedValue(undefined)
    await expect(updateLudotheque(LUDO, { name: 'X' })).rejects.toThrow(/introuvable/)
  })
})

describe('resetLudoPassword', () => {
  it('hache et écrit le nouveau hash', async () => {
    await resetLudoPassword(LUDO, 'newpass1')
    expect(updateLudoById).toHaveBeenCalledWith(LUDO, { passwordHash: 'hash:newpass1' })
  })

  it('refuse un mot de passe trop court', async () => {
    await expect(resetLudoPassword(LUDO, '123')).rejects.toThrow(/au moins 6/)
    expect(updateLudoById).not.toHaveBeenCalled()
  })
})
