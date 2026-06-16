import {
  createLoan,
  getLoanById,
  getOpenLoanForTheme,
  setLoanReturned,
  setLoanStatus,
} from '../db/loans.js'
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

  const open = await getOpenLoanForTheme(themeId)
  if (open) throw new LoanServiceError('Ce thème est déjà en prêt ou réservé.')

  return createLoan({
    themeId,
    fromLudoId,
    toLudoId,
    status: 'actif',
    notes: notes?.trim() || null,
  })
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

// ─── Flow pull (emprunt depuis le catalogue réseau) ──────────────────────────

/**
 * Demande de prêt (pull) : une ludo (`requestingLudoId`) demande un thème partagé
 * d'une autre ludo. Crée un prêt `en_attente` que le propriétaire devra confirmer.
 */
export async function requestTheme(
  themeId: string,
  requestingLudoId: string,
  notes?: string,
): Promise<ThemeLoanRow> {
  const theme = await getThemeById(themeId)
  if (!theme) throw new LoanServiceError('Thème introuvable.')
  if (theme.ownerLudoId === requestingLudoId) {
    throw new LoanServiceError('Ce thème appartient déjà à votre ludothèque.')
  }
  if (!theme.isShareable || theme.isArchived) {
    throw new LoanServiceError("Ce thème n'est pas disponible à l'emprunt.")
  }

  const open = await getOpenLoanForTheme(themeId)
  if (open) throw new LoanServiceError('Ce thème est déjà en prêt ou réservé.')

  return createLoan({
    themeId,
    fromLudoId: theme.ownerLudoId,
    toLudoId: requestingLudoId,
    status: 'en_attente',
    notes: notes?.trim() || null,
  })
}

/** Confirmation d'une demande par la ludo propriétaire → prêt actif. */
export async function confirmLoanRequest(loanId: string, ownerLudoId: string): Promise<void> {
  const loan = await getLoanById(loanId)
  if (!loan || loan.fromLudoId !== ownerLudoId) {
    throw new LoanServiceError('Demande introuvable.')
  }
  if (loan.status !== 'en_attente') {
    throw new LoanServiceError("Cette demande n'est plus en attente.")
  }
  await setLoanStatus(loanId, 'actif')
}

/** Refus d'une demande par la ludo propriétaire → annulée. */
export async function declineLoanRequest(loanId: string, ownerLudoId: string): Promise<void> {
  const loan = await getLoanById(loanId)
  if (!loan || loan.fromLudoId !== ownerLudoId) {
    throw new LoanServiceError('Demande introuvable.')
  }
  if (loan.status !== 'en_attente') {
    throw new LoanServiceError("Cette demande n'est plus en attente.")
  }
  await setLoanStatus(loanId, 'annule')
}

/** Retrait d'une demande en attente par la ludo demandeuse → annulée. */
export async function cancelLoanRequest(loanId: string, requestingLudoId: string): Promise<void> {
  const loan = await getLoanById(loanId)
  if (!loan || loan.toLudoId !== requestingLudoId) {
    throw new LoanServiceError('Demande introuvable.')
  }
  if (loan.status !== 'en_attente') {
    throw new LoanServiceError("Cette demande n'est plus en attente.")
  }
  await setLoanStatus(loanId, 'annule')
}
