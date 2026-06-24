import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/newsletter.js', () => ({
  getContactById: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  getCampaignById: vi.fn(),
  getCampaignSendStats: vi.fn(),
  // Autres exports référencés à l'import du service (non appelés ici).
  createCampaign: vi.fn(),
  createContact: vi.fn(),
  deleteCampaign: vi.fn(),
  findContactByEmail: vi.fn(),
  getContactEmails: vi.fn(),
  getSentContactIds: vi.fn(),
  insertCampaignSends: vi.fn(),
  insertContacts: vi.fn(),
  listSubscribedContacts: vi.fn(),
  updateCampaign: vi.fn(),
}))
vi.mock('../resend.js', () => ({ getResend: vi.fn(), newsletterFrom: vi.fn() }))
vi.mock('./events.js', () => ({ emitEvent: vi.fn() }))

import {
  deleteContact,
  getCampaignById,
  getCampaignSendStats,
  getContactById,
  updateContact,
} from '../db/newsletter.js'
import {
  anonymizeContact,
  getCampaignStats,
  NewsletterServiceError,
  setContactSubscription,
} from './newsletter.js'

const LUDO = 'ludo-a'
const ID = 'contact-1'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getContactById).mockResolvedValue({ id: ID, ludoId: LUDO, email: 'a@b.ch' } as never)
  vi.mocked(updateContact).mockResolvedValue({ id: ID, ludoId: LUDO } as never)
})

describe('setContactSubscription', () => {
  it('désabonne un contact', async () => {
    await setContactSubscription(ID, LUDO, false)
    expect(updateContact).toHaveBeenCalledWith(ID, LUDO, { status: 'unsubscribed' })
  })

  it('réabonne un contact', async () => {
    await setContactSubscription(ID, LUDO, true)
    expect(updateContact).toHaveBeenCalledWith(ID, LUDO, { status: 'subscribed' })
  })

  it('échoue si le contact est introuvable', async () => {
    vi.mocked(updateContact).mockResolvedValue(undefined as never)
    await expect(setContactSubscription(ID, LUDO, false)).rejects.toThrow(NewsletterServiceError)
  })
})

describe('anonymizeContact', () => {
  it('neutralise les données et désabonne, sans supprimer la ligne', async () => {
    await anonymizeContact(ID, LUDO)
    expect(updateContact).toHaveBeenCalledWith(
      ID,
      LUDO,
      expect.objectContaining({
        email: `anonyme-${ID}@anonyme.invalid`,
        firstName: null,
        lastName: null,
        notes: null,
        status: 'unsubscribed',
      }),
    )
    expect(deleteContact).not.toHaveBeenCalled()
  })

  it('échoue si le contact est introuvable', async () => {
    vi.mocked(getContactById).mockResolvedValue(undefined as never)
    await expect(anonymizeContact(ID, LUDO)).rejects.toThrow(NewsletterServiceError)
    expect(updateContact).not.toHaveBeenCalled()
  })
})

describe('getCampaignStats', () => {
  it('renvoie les stats si la campagne appartient à la ludo', async () => {
    vi.mocked(getCampaignById).mockResolvedValue({ id: 'c-1', ludoId: LUDO } as never)
    vi.mocked(getCampaignSendStats).mockResolvedValue({ sent: 5, failed: 1, bounced: 2 })
    const stats = await getCampaignStats('c-1', LUDO)
    expect(stats).toEqual({ sent: 5, failed: 1, bounced: 2 })
  })

  it('refuse une campagne d’une autre ludo', async () => {
    vi.mocked(getCampaignById).mockResolvedValue(undefined as never)
    await expect(getCampaignStats('c-1', LUDO)).rejects.toThrow(NewsletterServiceError)
    expect(getCampaignSendStats).not.toHaveBeenCalled()
  })
})
