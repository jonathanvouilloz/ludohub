import { and, eq } from 'drizzle-orm'
import { db } from './index.js'
import { themeLoans, type ThemeLoanInsert } from '../schema.js'

export async function getActiveLoanForTheme(themeId: string) {
  return db.query.themeLoans.findFirst({
    where: and(eq(themeLoans.themeId, themeId), eq(themeLoans.status, 'actif')),
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

export async function getLoanHistory(themeId: string) {
  return db.query.themeLoans.findMany({
    where: eq(themeLoans.themeId, themeId),
    with: { toLudo: true },
    orderBy: (l, { desc }) => desc(l.createdAt),
  })
}
