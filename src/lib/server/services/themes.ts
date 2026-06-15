import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { themeLoans, themeImages, type ThemeInsert } from '../schema.js'
import { themes } from '../schema.js'
import { getActiveLoansForTheme } from '../db/themes.js'

export async function createThemeWithItems(
  data: ThemeInsert,
  items: Array<{ name: string; quantity: number }>,
) {
  const [theme] = await db.insert(themes).values(data).returning()

  if (items.length > 0) {
    await db.insert(
      (await import('../schema.js')).themeItems,
    ).values(items.map((item) => ({ ...item, themeId: theme.id })))
  }

  return theme
}

/**
 * Prêt push : la ludo propriétaire prête à une autre ludo.
 * Vérifie qu'il n'y a pas de prêt actif existant.
 */
export async function lendTheme(
  themeId: string,
  fromLudoId: string,
  toLudoId: string,
  notes?: string,
) {
  const active = await getActiveLoansForTheme(themeId)
  if (active) throw new Error('Ce thème est déjà en prêt')

  const [loan] = await db
    .insert(themeLoans)
    .values({ themeId, fromLudoId, toLudoId, notes })
    .returning()
  return loan
}

/**
 * Retour de prêt.
 */
export async function returnTheme(loanId: string) {
  const [loan] = await db
    .update(themeLoans)
    .set({ status: 'retourne' })
    .where(and(eq(themeLoans.id, loanId), eq(themeLoans.status, 'actif')))
    .returning()
  if (!loan) throw new Error('Prêt introuvable ou déjà terminé')
  return loan
}

/**
 * Ajoute une image à un thème (max 3).
 */
export async function addThemeImage(themeId: string, url: string, storageKey: string) {
  const existing = await db.query.themeImages.findMany({
    where: eq(themeImages.themeId, themeId),
  })
  if (existing.length >= 3) throw new Error('Maximum 3 images par thème')

  const [image] = await db.insert(themeImages).values({ themeId, url, storageKey }).returning()
  return image
}
