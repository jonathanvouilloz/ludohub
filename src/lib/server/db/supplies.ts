import { eq } from 'drizzle-orm'
import { db } from './index.js'
import { supplyRequests, type SupplyRequestInsert } from '../schema.js'

// ─── Demandes de matériel ──────────────────────────────────────────────────────

export async function getSuppliesByLudo(ludoId: string) {
  return db.query.supplyRequests.findMany({
    where: eq(supplyRequests.ludoId, ludoId),
    with: { member: true },
    orderBy: (s, { desc }) => desc(s.createdAt),
  })
}

export async function getSupplyById(id: string) {
  return db.query.supplyRequests.findFirst({
    where: eq(supplyRequests.id, id),
    with: { member: true },
  })
}

export async function createSupply(data: SupplyRequestInsert) {
  const [supply] = await db.insert(supplyRequests).values(data).returning()
  return supply
}

export async function updateSupply(id: string, data: Partial<Pick<SupplyRequestInsert, 'status'>>) {
  const [supply] = await db
    .update(supplyRequests)
    .set(data)
    .where(eq(supplyRequests.id, id))
    .returning()
  return supply
}

export async function deleteSupply(id: string): Promise<void> {
  await db.delete(supplyRequests).where(eq(supplyRequests.id, id))
}
