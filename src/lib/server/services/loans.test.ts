import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/loans.js', () => ({
  getActiveLoanForTheme: vi.fn(),
  getLoanById: vi.fn(),
  createLoan: vi.fn(),
  setLoanReturned: vi.fn(),
}))
vi.mock('../db/ludotheques.js', () => ({ getLudoById: vi.fn() }))
vi.mock('../db/themes.js', () => ({ getThemeById: vi.fn() }))

import { createLoan, getActiveLoanForTheme, getLoanById, setLoanReturned } from '../db/loans.js'
import { getLudoById } from '../db/ludotheques.js'
import { getThemeById } from '../db/themes.js'
import { loanTheme, returnTheme, LoanServiceError } from './loans.js'

const OWNER = 'ludo-a'
const TARGET = 'ludo-b'
const THEME = 'theme-1'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getThemeById).mockResolvedValue({
    id: THEME,
    ownerLudoId: OWNER,
    isArchived: false,
  } as never)
  vi.mocked(getLudoById).mockResolvedValue({ id: TARGET, name: 'Ludo B' } as never)
  vi.mocked(getActiveLoanForTheme).mockResolvedValue(undefined as never)
  vi.mocked(createLoan).mockResolvedValue({ id: 'loan-1' } as never)
})

describe('loanTheme', () => {
  it('crée un prêt quand tout est valide', async () => {
    await loanTheme(THEME, OWNER, TARGET, ' note ')
    expect(createLoan).toHaveBeenCalledWith({
      themeId: THEME,
      fromLudoId: OWNER,
      toLudoId: TARGET,
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

  it('refuse si un prêt actif existe déjà', async () => {
    vi.mocked(getActiveLoanForTheme).mockResolvedValue({ id: 'loan-x', status: 'actif' } as never)
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
