import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { helpRequests, helpResponses } from '../schema.js'

export async function createHelpRequest(
  ludoId: string,
  date: string,
  slotInfo?: string,
  notes?: string,
) {
  const [request] = await db
    .insert(helpRequests)
    .values({ ludoId, date, slotInfo, notes })
    .returning()
  return request
}

export async function respondToRequest(
  helpRequestId: string,
  memberId: string,
  ludoId: string,
) {
  const [response] = await db
    .insert(helpResponses)
    .values({ helpRequestId, memberId, ludoId })
    .returning()
  return response
}

export async function confirmVolunteer(helpRequestId: string, helpResponseId: string) {
  await db
    .update(helpResponses)
    .set({ status: 'confirme' })
    .where(eq(helpResponses.id, helpResponseId))

  const [request] = await db
    .update(helpRequests)
    .set({ status: 'pourvue' })
    .where(eq(helpRequests.id, helpRequestId))
    .returning()
  return request
}
