import { and, eq, inArray } from 'drizzle-orm'
import { db } from './index.js'
import { themeLoans, type ThemeLoanInsert } from '../schema.js'

export async function getActiveLoanForTheme(themeId: string) {
  return db.query.themeLoans.findFirst({
    where: and(eq(themeLoans.themeId, themeId), eq(themeLoans.status, 'actif')),
  })
}

/** Prêt actif d'un thème vers une ludo donnée (autorise l'installation côté emprunteur). */
export async function getActiveLoanToLudo(themeId: string, toLudoId: string) {
  return db.query.themeLoans.findFirst({
    where: and(
      eq(themeLoans.themeId, themeId),
      eq(themeLoans.toLudoId, toLudoId),
      eq(themeLoans.status, 'actif'),
    ),
  })
}

/** Prêt « ouvrant » : actif ou en attente de confirmation. Bloque push & pull. */
export async function getOpenLoanForTheme(themeId: string) {
  return db.query.themeLoans.findFirst({
    where: and(
      eq(themeLoans.themeId, themeId),
      inArray(themeLoans.status, ['actif', 'en_attente']),
    ),
  })
}

export async function getLoanById(id: string) {
  return db.query.themeLoans.findFirst({ where: eq(themeLoans.id, id) })
}

export async function createLoan(data: ThemeLoanInsert) {
  const [loan] = await db.insert(themeLoans).values(data).returning()
  return loan
}

export async function setLoanReturned(id: string) {
  const [loan] = await db
    .update(themeLoans)
    .set({ status: 'retourne' })
    .where(and(eq(themeLoans.id, id), eq(themeLoans.status, 'actif')))
    .returning()
  return loan
}

/** Transition générique d'un prêt (confirmation → actif, refus/annulation → annule). */
export async function setLoanStatus(id: string, status: 'actif' | 'retourne' | 'annule') {
  const [loan] = await db
    .update(themeLoans)
    .set({ status })
    .where(eq(themeLoans.id, id))
    .returning()
  return loan
}

export async function getLoanHistory(themeId: string) {
  return db.query.themeLoans.findMany({
    where: eq(themeLoans.themeId, themeId),
    with: { toLudo: true },
    orderBy: (l, { desc }) => desc(l.createdAt),
  })
}
