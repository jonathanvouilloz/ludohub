import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from './index.js'
import { helpRequests, helpResponses, type HelpRequestRow } from '../schema.js'

// ─── Demandes ────────────────────────────────────────────────────────────────

export async function createHelpRequest(data: {
  ludoId: string
  date: string
  slotInfo: string | null
  notes: string | null
}): Promise<HelpRequestRow> {
  const [request] = await db.insert(helpRequests).values(data).returning()
  return request
}

export async function getHelpRequestById(id: string) {
  return db.query.helpRequests.findFirst({ where: eq(helpRequests.id, id) })
}

/** Feed cross-ludo : demandes ouvertes, avec ludo demandeuse + volontaires. */
export async function getOpenRequests() {
  return db.query.helpRequests.findMany({
    where: eq(helpRequests.status, 'ouverte'),
    with: {
      ludo: true,
      responses: { with: { member: true, ludo: true } },
    },
    orderBy: (r, { asc }) => asc(r.date),
  })
}

/** Demandes passées d'une ludo (pourvues ou annulées) pour l'historique. */
export async function getPastRequestsForLudo(ludoId: string) {
  return db.query.helpRequests.findMany({
    where: and(
      eq(helpRequests.ludoId, ludoId),
      inArray(helpRequests.status, ['pourvue', 'annulee']),
    ),
    with: { responses: { with: { member: true, ludo: true } } },
    orderBy: (r, { desc }) => desc(r.date),
  })
}

export async function setRequestStatus(id: string, status: 'ouverte' | 'pourvue' | 'annulee') {
  await db.update(helpRequests).set({ status }).where(eq(helpRequests.id, id))
}

// ─── Réponses ────────────────────────────────────────────────────────────────

export async function createResponse(data: {
  helpRequestId: string
  memberId: string
  ludoId: string
}) {
  const [response] = await db.insert(helpResponses).values(data).returning()
  return response
}

export async function getResponseById(id: string) {
  return db.query.helpResponses.findFirst({ where: eq(helpResponses.id, id) })
}

export async function hasMemberResponded(requestId: string, memberId: string): Promise<boolean> {
  const existing = await db.query.helpResponses.findFirst({
    where: and(eq(helpResponses.helpRequestId, requestId), eq(helpResponses.memberId, memberId)),
    columns: { id: true },
  })
  return !!existing
}

export async function setResponseStatus(id: string, status: 'propose' | 'confirme' | 'refuse') {
  await db.update(helpResponses).set({ status }).where(eq(helpResponses.id, id))
}

/** Refuse toutes les autres réponses d'une demande (à la confirmation d'un volontaire). */
export async function refuseOtherResponses(requestId: string, exceptResponseId: string) {
  await db
    .update(helpResponses)
    .set({ status: 'refuse' })
    .where(and(eq(helpResponses.helpRequestId, requestId), ne(helpResponses.id, exceptResponseId)))
}
