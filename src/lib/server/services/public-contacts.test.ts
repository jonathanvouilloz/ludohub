import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/ludotheques.js', () => ({ getLudoBySlug: vi.fn() }))
vi.mock('../db/public-contacts.js', () => ({
  getPublicContactByIdempotency: vi.fn(),
  getPublicContactRowForLudo: vi.fn(),
  insertPublicContactRow: vi.fn(),
  listPublicContactRows: vi.fn(),
  transitionPublicContactRow: vi.fn(),
}))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled: vi.fn() }))

import { getLudoBySlug } from '../db/ludotheques.js'
import { getPublicContactByIdempotency, insertPublicContactRow } from '../db/public-contacts.js'
import { isPublicSiteEnabled } from './public-site.js'
import { submitPublicContactByLudoSlug } from './public-contacts.js'

const input = {
  recipient: 'paquis' as const,
  name: 'Ada Lovelace',
  email: 'ADA@EXAMPLE.CH',
  subject: 'Question jeux',
  message: 'Bonjour, avez-vous ce jeu ?',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getLudoBySlug).mockResolvedValue({ id: 'ludo-a', slug: 'demo' } as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(getPublicContactByIdempotency).mockResolvedValue(undefined)
  vi.mocked(insertPublicContactRow).mockImplementation(async (value) => value as never)
})

describe('contact public', () => {
  it('stocke dans le bon tenant sans exposer le message dans le reçu', async () => {
    const result = await submitPublicContactByLudoSlug('demo', 'request-00000001', input)
    expect(result).toEqual({ receiptId: expect.any(String), created: true })
    expect(result).not.toHaveProperty('message')
    expect(insertPublicContactRow).toHaveBeenCalledWith(
      expect.objectContaining({
        ludoId: 'ludo-a',
        recipient: 'paquis',
        email: 'ada@example.ch',
        subject: 'Question jeux',
        status: 'new',
        idempotencyKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    )
  })

  it('retourne le même reçu sans nouvelle écriture pour une clé rejouée', async () => {
    vi.mocked(getPublicContactByIdempotency).mockResolvedValueOnce({ id: 'receipt-a' } as never)
    await expect(submitPublicContactByLudoSlug('demo', 'request-00000001', input)).resolves.toEqual(
      {
        receiptId: 'receipt-a',
        created: false,
      },
    )
    expect(insertPublicContactRow).not.toHaveBeenCalled()
  })

  it.each([
    [{ ...input, recipient: 'ailleurs' }, /Destinataire/],
    [{ ...input, subject: '' }, /sujet/],
    [{ ...input, email: 'invalide' }, /e-mail/],
  ])('rejette un formulaire invalide', async (badInput, message) => {
    await expect(
      submitPublicContactByLudoSlug('demo', 'request-00000001', badInput as never),
    ).rejects.toThrow(message)
  })

  it('ne révèle pas un tenant inconnu ou dont le module est désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValueOnce(false)
    await expect(
      submitPublicContactByLudoSlug('demo', 'request-00000001', input),
    ).rejects.toMatchObject({ code: 'not_found' })
  })
})
