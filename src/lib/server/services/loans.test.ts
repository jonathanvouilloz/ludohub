import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/loans.js', () => ({
  getOpenLoanForTheme: vi.fn(),
  getLoanById: vi.fn(),
  createLoan: vi.fn(),
  setLoanReturned: vi.fn(),
  setLoanStatus: vi.fn(),
}))
vi.mock('../db/ludotheques.js', () => ({ getLudoById: vi.fn() }))
vi.mock('../db/themes.js', () => ({ getThemeById: vi.fn() }))

import {
  createLoan,
  getLoanById,
  getOpenLoanForTheme,
  setLoanReturned,
  setLoanStatus,
} from '../db/loans.js'
import { getLudoById } from '../db/ludotheques.js'
import { getThemeById } from '../db/themes.js'
import {
  cancelLoanRequest,
  confirmLoanRequest,
  declineLoanRequest,
  loanTheme,
  requestTheme,
  returnTheme,
  LoanServiceError,
} from './loans.js'

const OWNER = 'ludo-a'
const TARGET = 'ludo-b'
const THEME = 'theme-1'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getThemeById).mockResolvedValue({
    id: THEME,
    ownerLudoId: OWNER,
    isArchived: false,
    isShareable: true,
  } as never)
  vi.mocked(getLudoById).mockResolvedValue({ id: TARGET, name: 'Ludo B' } as never)
  vi.mocked(getOpenLoanForTheme).mockResolvedValue(undefined as never)
  vi.mocked(createLoan).mockResolvedValue({ id: 'loan-1' } as never)
})

describe('loanTheme', () => {
  it('crée un prêt actif quand tout est valide', async () => {
    await loanTheme(THEME, OWNER, TARGET, ' note ')
    expect(createLoan).toHaveBeenCalledWith({
      themeId: THEME,
      fromLudoId: OWNER,
      toLudoId: TARGET,
      status: 'actif',
      notes: 'note',
    })
  })

  it('refuse si le thème n’appartient pas à la ludo', async () => {
    vi.mocked(getThemeById).mockResolvedValue({
      id: THEME,
      ownerLudoId: 'autre',
      isArchived: false,
    } as never)
    await expect(loanTheme(THEME, OWNER, TARGET)).rejects.toThrow(LoanServiceError)
  })

  it('refuse un thème archivé', async () => {
    vi.mocked(getThemeById).mockResolvedValue({
      id: THEME,
      ownerLudoId: OWNER,
      isArchived: true,
    } as never)
    await expect(loanTheme(THEME, OWNER, TARGET)).rejects.toThrow(/archivé/)
  })

  it('refuse de prêter à soi-même', async () => {
    await expect(loanTheme(THEME, OWNER, OWNER)).rejects.toThrow(LoanServiceError)
  })

  it('refuse si un prêt ouvert existe déjà', async () => {
    vi.mocked(getOpenLoanForTheme).mockResolvedValue({ id: 'loan-x', status: 'actif' } as never)
    await expect(loanTheme(THEME, OWNER, TARGET)).rejects.toThrow(/déjà en prêt/)
    expect(createLoan).not.toHaveBeenCalled()
  })
})

describe('returnTheme', () => {
  it('clôture un prêt actif de la ludo propriétaire', async () => {
    vi.mocked(getLoanById).mockResolvedValue({
      id: 'loan-1',
      fromLudoId: OWNER,
      status: 'actif',
    } as never)
    await returnTheme('loan-1', OWNER)
    expect(setLoanReturned).toHaveBeenCalledWith('loan-1')
  })

  it('refuse un prêt déjà retourné', async () => {
    vi.mocked(getLoanById).mockResolvedValue({
      id: 'loan-1',
      fromLudoId: OWNER,
      status: 'retourne',
    } as never)
    await expect(returnTheme('loan-1', OWNER)).rejects.toThrow(/déjà terminé/)
  })

  it('refuse si le prêt appartient à une autre ludo', async () => {
    vi.mocked(getLoanById).mockResolvedValue({
      id: 'loan-1',
      fromLudoId: 'autre',
      status: 'actif',
    } as never)
    await expect(returnTheme('loan-1', OWNER)).rejects.toThrow(LoanServiceError)
  })
})

describe('requestTheme (pull)', () => {
  it('crée une demande en_attente sur un thème partagé', async () => {
    await requestTheme(THEME, TARGET, ' besoin ')
    expect(createLoan).toHaveBeenCalledWith({
      themeId: THEME,
      fromLudoId: OWNER,
      toLudoId: TARGET,
      status: 'en_attente',
      notes: 'besoin',
    })
  })

  it('refuse de demander son propre thème', async () => {
    await expect(requestTheme(THEME, OWNER)).rejects.toThrow(/appartient déjà/)
    expect(createLoan).not.toHaveBeenCalled()
  })

  it('refuse un thème non partagé', async () => {
    vi.mocked(getThemeById).mockResolvedValue({
      id: THEME,
      ownerLudoId: OWNER,
      isArchived: false,
      isShareable: false,
    } as never)
    await expect(requestTheme(THEME, TARGET)).rejects.toThrow(/disponible/)
  })

  it('refuse si un prêt ouvert existe déjà', async () => {
    vi.mocked(getOpenLoanForTheme).mockResolvedValue({ id: 'loan-x', status: 'actif' } as never)
    await expect(requestTheme(THEME, TARGET)).rejects.toThrow(/déjà en prêt/)
    expect(createLoan).not.toHaveBeenCalled()
  })
})

describe('confirmLoanRequest / declineLoanRequest / cancelLoanRequest', () => {
  it('confirme une demande en attente côté propriétaire → actif', async () => {
    vi.mocked(getLoanById).mockResolvedValue({
      id: 'loan-1',
      fromLudoId: OWNER,
      toLudoId: TARGET,
      status: 'en_attente',
    } as never)
    await confirmLoanRequest('loan-1', OWNER)
    expect(setLoanStatus).toHaveBeenCalledWith('loan-1', 'actif')
  })

  it('refuse de confirmer une demande qui n’est plus en attente', async () => {
    vi.mocked(getLoanById).mockResolvedValue({
      id: 'loan-1',
      fromLudoId: OWNER,
      status: 'actif',
    } as never)
    await expect(confirmLoanRequest('loan-1', OWNER)).rejects.toThrow(/plus en attente/)
  })

  it('le propriétaire refuse une demande → annule', async () => {
    vi.mocked(getLoanById).mockResolvedValue({
      id: 'loan-1',
      fromLudoId: OWNER,
      status: 'en_attente',
    } as never)
    await declineLoanRequest('loan-1', OWNER)
    expect(setLoanStatus).toHaveBeenCalledWith('loan-1', 'annule')
  })

  it('le demandeur retire sa demande → annule', async () => {
    vi.mocked(getLoanById).mockResolvedValue({
      id: 'loan-1',
      toLudoId: TARGET,
      status: 'en_attente',
    } as never)
    await cancelLoanRequest('loan-1', TARGET)
    expect(setLoanStatus).toHaveBeenCalledWith('loan-1', 'annule')
  })

  it('refuse une confirmation par une autre ludo', async () => {
    vi.mocked(getLoanById).mockResolvedValue({
      id: 'loan-1',
      fromLudoId: 'autre',
      status: 'en_attente',
    } as never)
    await expect(confirmLoanRequest('loan-1', OWNER)).rejects.toThrow(LoanServiceError)
  })
})
