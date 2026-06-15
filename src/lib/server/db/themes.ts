import { and, eq, ne } from 'drizzle-orm'
import { db } from './index.js'
import { themes, themeLoans, type ThemeInsert } from '../schema.js'

export async function getThemesByLudo(ludoId: string) {
  return db.query.themes.findMany({
    where: and(eq(themes.ownerLudoId, ludoId), eq(themes.isArchived, false)),
    with: { items: true, images: true },
    orderBy: (t, { asc }) => asc(t.name),
  })
}

export async function getShareableThemes(excludeLudoId: string) {
  return db.query.themes.findMany({
    where: and(
      eq(themes.isShareable, true),
      eq(themes.isArchived, false),
      ne(themes.ownerLudoId, excludeLudoId),
    ),
    with: { items: true, images: true, ownerLudo: true },
    orderBy: (t, { asc }) => asc(t.name),
  })
}

export async function getActiveLoansForTheme(themeId: string) {
  return db.query.themeLoans.findFirst({
    where: and(eq(themeLoans.themeId, themeId), eq(themeLoans.status, 'actif')),
  })
}

export async function createTheme(data: ThemeInsert) {
  const [theme] = await db.insert(themes).values(data).returning()
  return theme
}
