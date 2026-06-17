import { createWish, deleteWish, getWishById, getWishesByLudo, updateWish } from '../db/wishes.js'
import type { GameWishRow } from '../schema.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class WishServiceError extends Error {}

function parseTitle(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new WishServiceError('Le titre est requis.')
  if (trimmed.length > 200) throw new WishServiceError('Le titre est trop long (200 max).')
  return trimmed
}

/** Lien optionnel : doit être une URL http(s) si fourni. */
function parseLink(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new WishServiceError('Le lien doit commencer par http:// ou https://.')
  }
  if (trimmed.length > 500) throw new WishServiceError('Le lien est trop long (500 max).')
  return trimmed
}

/** Prix optionnel en CHF (« 12.50 ») → centimes (1250). */
function parsePriceChf(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) {
    throw new WishServiceError('Le prix doit être un nombre positif.')
  }
  return Math.round(n * 100)
}

/** Charge un souhait et vérifie qu'il appartient bien à la ludo. */
async function requireWishInLudo(id: string, ludoId: string) {
  const wish = await getWishById(id)
  if (!wish || wish.ludoId !== ludoId) {
    throw new WishServiceError('Souhait introuvable.')
  }
  return wish
}

export async function listGameWishes(ludoId: string) {
  return getWishesByLudo(ludoId)
}

export async function createGameWish(
  ludoId: string,
  data: { title: string; link?: string; priceChf?: string },
  addedById: string,
): Promise<GameWishRow> {
  return createWish({
    ludoId,
    title: parseTitle(data.title),
    link: parseLink(data.link ?? ''),
    priceChf: parsePriceChf(data.priceChf ?? ''),
    addedById,
  })
}

export async function setBought(id: string, ludoId: string, buyerId: string): Promise<GameWishRow> {
  await requireWishInLudo(id, ludoId)
  return updateWish(id, { status: 'achete', buyerId })
}

export async function setWanted(id: string, ludoId: string): Promise<GameWishRow> {
  await requireWishInLudo(id, ludoId)
  return updateWish(id, { status: 'souhaite', buyerId: null })
}

export async function deleteGameWish(id: string, ludoId: string): Promise<void> {
  await requireWishInLudo(id, ludoId)
  await deleteWish(id)
}
