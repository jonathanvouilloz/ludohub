import { createLoan, getActiveLoanForTheme, getLoanById, setLoanReturned } from '../db/loans.js'
import { getLudoById } from '../db/ludotheques.js'
import { getThemeById } from '../db/themes.js'
import type { ThemeLoanRow } from '../schema.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class LoanServiceError extends Error {}

/**
 * Prêt push : la ludo propriétaire (`fromLudoId`) prête un thème à une autre
 * ludo. Refuse si un prêt actif existe déjà ou si la cible est invalide.
 */
export async function loanTheme(
  themeId: string,
  fromLudoId: string,
  toLudoId: string,
  notes?: string,
): Promise<ThemeLoanRow> {
  const theme = await getThemeById(themeId)
  if (!theme || theme.ownerLudoId !== fromLudoId) {
    throw new LoanServiceError('Thème introuvable.')
  }
  if (theme.isArchived) {
    throw new LoanServiceError('Un thème archivé ne peut pas être prêté.')
  }
  if (!toLudoId || toLudoId === fromLudoId) {
    throw new LoanServiceError('Choisissez une autre ludothèque comme destinataire.')
  }
  const target = await getLudoById(toLudoId)
  if (!target) throw new LoanServiceError('Ludothèque destinataire introuvable.')

  const active = await getActiveLoanForTheme(themeId)
  if (active) throw new LoanServiceError('Ce thème est déjà en prêt.')

  return createLoan({ themeId, fromLudoId, toLudoId, notes: notes?.trim() || null })
}

/** Retour de prêt par la ludo propriétaire. */
export async function returnTheme(loanId: string, ludoId: string): Promise<void> {
  const loan = await getLoanById(loanId)
  if (!loan || loan.fromLudoId !== ludoId) {
    throw new LoanServiceError('Prêt introuvable.')
  }
  if (loan.status !== 'actif') {
    throw new LoanServiceError('Ce prêt est déjà terminé.')
  }
  await setLoanReturned(loanId)
}
