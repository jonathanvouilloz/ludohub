import {
  createHelpRequest,
  createResponse,
  getHelpRequestById,
  getOpenRequests,
  getPastRequestsForLudo,
  getResponseById,
  hasMemberResponded,
  refuseOtherResponses,
  setRequestStatus,
  setResponseStatus,
} from '../db/help.js'
import type { HelpRequestRow, HelpResponseRow } from '../schema.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class HelpServiceError extends Error {}

// ─── Création / annulation (côté ludo demandeuse) ────────────────────────────

export async function publishHelpRequest(
  ludoId: string,
  data: { date: string; slotInfo?: string; notes?: string },
): Promise<HelpRequestRow> {
  const date = data.date?.trim()
  if (!date) throw new HelpServiceError('La date est requise.')
  return createHelpRequest({
    ludoId,
    date,
    slotInfo: data.slotInfo?.trim() || null,
    notes: data.notes?.trim() || null,
  })
}

export async function cancelRequest(requestId: string, requestingLudoId: string): Promise<void> {
  const request = await getHelpRequestById(requestId)
  if (!request || request.ludoId !== requestingLudoId) {
    throw new HelpServiceError('Demande introuvable.')
  }
  if (request.status !== 'ouverte') {
    throw new HelpServiceError("Cette demande n'est plus ouverte.")
  }
  await setRequestStatus(requestId, 'annulee')
}

// ─── Réponse volontaire (côté autre ludo) ────────────────────────────────────

export async function respondToRequest(
  requestId: string,
  memberId: string,
  responderLudoId: string,
): Promise<HelpResponseRow> {
  const request = await getHelpRequestById(requestId)
  if (!request) throw new HelpServiceError('Demande introuvable.')
  if (request.status !== 'ouverte') {
    throw new HelpServiceError("Cette demande n'est plus ouverte.")
  }
  if (request.ludoId === responderLudoId) {
    throw new HelpServiceError(
      'Vous ne pouvez pas répondre à une demande de votre propre ludothèque.',
    )
  }
  if (await hasMemberResponded(requestId, memberId)) {
    throw new HelpServiceError('Vous avez déjà répondu à cette demande.')
  }
  return createResponse({ helpRequestId: requestId, memberId, ludoId: responderLudoId })
}

// ─── Confirmation d'un volontaire (côté ludo demandeuse) ─────────────────────

export async function confirmVolunteer(
  requestId: string,
  responseId: string,
  requestingLudoId: string,
): Promise<void> {
  const request = await getHelpRequestById(requestId)
  if (!request || request.ludoId !== requestingLudoId) {
    throw new HelpServiceError('Demande introuvable.')
  }
  if (request.status !== 'ouverte') {
    throw new HelpServiceError("Cette demande n'est plus ouverte.")
  }
  const response = await getResponseById(responseId)
  if (!response || response.helpRequestId !== requestId) {
    throw new HelpServiceError('Volontaire introuvable.')
  }
  await setResponseStatus(responseId, 'confirme')
  await refuseOtherResponses(requestId, responseId)
  await setRequestStatus(requestId, 'pourvue')
}

// ─── Lectures ────────────────────────────────────────────────────────────────

/**
 * Feed annoté pour la ludo courante : `isMine` (publiée par elle) + `myResponse`
 * (réponse du membre courant si existante) pour piloter l'affichage des actions.
 */
export async function getFeed(currentLudoId: string, currentMemberId: string) {
  const requests = await getOpenRequests()
  return requests.map((req) => ({
    ...req,
    isMine: req.ludoId === currentLudoId,
    myResponse: req.responses.find((r) => r.memberId === currentMemberId) ?? null,
  }))
}

export async function getPastForLudo(ludoId: string) {
  return getPastRequestsForLudo(ludoId)
}
