import { eq } from 'drizzle-orm'
import { db } from './index.js'
import { gameWishes, type GameWishInsert } from '../schema.js'

// ─── Wishlist jeux ───────────────────────────────────────────────────────────

export async function getWishesByLudo(ludoId: string) {
  return db.query.gameWishes.findMany({
    where: eq(gameWishes.ludoId, ludoId),
    with: { buyer: true },
    orderBy: (w, { desc }) => desc(w.createdAt),
  })
}

export async function getWishById(id: string) {
  return db.query.gameWishes.findFirst({
    where: eq(gameWishes.id, id),
    with: { buyer: true },
  })
}

export async function createWish(data: GameWishInsert) {
  const [wish] = await db.insert(gameWishes).values(data).returning()
  return wish
}

export async function updateWish(
  id: string,
  data: Partial<Pick<GameWishInsert, 'title' | 'link' | 'priceChf' | 'status' | 'buyerId'>>,
) {
  const [wish] = await db.update(gameWishes).set(data).where(eq(gameWishes.id, id)).returning()
  return wish
}

export async function deleteWish(id: string): Promise<void> {
  await db.delete(gameWishes).where(eq(gameWishes.id, id))
}
