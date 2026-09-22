import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/ludotheques.js', () => ({
  updateLudoById: vi.fn(),
}))

vi.mock('./auth.js', () => ({
  hashLudoPassword: vi.fn(async (password: string) => `hash:${password}`),
}))

vi.mock('better-auth/crypto', () => ({
  verifyPassword: vi.fn(),
}))

import { updateLudoById } from '../db/ludotheques.js'
import { hashLudoPassword } from './auth.js'
import { verifyPassword } from 'better-auth/crypto'
import { changeLudoPassword, LudothequeServiceError } from './ludotheque.js'

const ludo = { id: 'ludo-1', passwordHash: 'existing-hash' } as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifyPassword).mockResolvedValue(true)
  vi.mocked(updateLudoById).mockResolvedValue({ id: ludo.id } as never)
})

describe('changeLudoPassword', () => {
  it('vérifie le mot de passe courant et enregistre le nouveau hash', async () => {
    await changeLudoPassword(ludo as never, 'ancien-secret', 'nouveau-secret')

    expect(verifyPassword).toHaveBeenCalledWith({
      hash: 'existing-hash',
      password: 'ancien-secret',
    })
    expect(hashLudoPassword).toHaveBeenCalledWith('nouveau-secret')
    expect(updateLudoById).toHaveBeenCalledWith('ludo-1', { passwordHash: 'hash:nouveau-secret' })
  })

  it('refuse un mot de passe courant incorrect', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false)

    await expect(changeLudoPassword(ludo as never, 'mauvais', 'nouveau-secret')).rejects.toThrow(
      'mot de passe actuel est incorrect',
    )
    expect(updateLudoById).not.toHaveBeenCalled()
  })

  it('refuse un nouveau mot de passe trop court', async () => {
    await expect(changeLudoPassword(ludo as never, 'ancien-secret', '123')).rejects.toThrow(
      LudothequeServiceError,
    )
    expect(hashLudoPassword).not.toHaveBeenCalled()
    expect(updateLudoById).not.toHaveBeenCalled()
  })
})
