import { and, eq, ne } from 'drizzle-orm'
import { db } from './index.js'
import {
  themeImages,
  themeItems,
  themes,
  type ThemeImageInsert,
  type ThemeInsert,
  type ThemeItemInsert,
} from '../schema.js'

// ─── Thèmes ────────────────────────────────────────────────────────────────

export async function getThemesByLudo(ludoId: string) {
  return db.query.themes.findMany({
    where: and(eq(themes.ownerLudoId, ludoId), eq(themes.isArchived, false)),
    with: { items: true, images: true, loans: true },
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
    with: { items: true, images: true, ownerLudo: true, loans: { with: { toLudo: true } } },
    orderBy: (t, { asc }) => asc(t.name),
  })
}

export async function getThemeById(id: string) {
  return db.query.themes.findFirst({
    where: eq(themes.id, id),
    with: {
      items: { orderBy: (i, { asc }) => asc(i.name) },
      images: { orderBy: (img, { asc }) => asc(img.createdAt) },
      ownerLudo: true,
      loans: { with: { toLudo: true }, orderBy: (l, { desc }) => desc(l.createdAt) },
    },
  })
}

export async function createTheme(data: ThemeInsert) {
  const [theme] = await db.insert(themes).values(data).returning()
  return theme
}

export async function updateTheme(
  id: string,
  data: Partial<Pick<ThemeInsert, 'name' | 'description' | 'isShareable' | 'isArchived'>>,
) {
  const [theme] = await db.update(themes).set(data).where(eq(themes.id, id)).returning()
  return theme
}

// ─── Items ─────────────────────────────────────────────────────────────────

export async function addThemeItem(data: ThemeItemInsert) {
  const [item] = await db.insert(themeItems).values(data).returning()
  return item
}

export async function deleteThemeItem(id: string): Promise<void> {
  await db.delete(themeItems).where(eq(themeItems.id, id))
}

export async function getThemeItemById(id: string) {
  return db.query.themeItems.findFirst({ where: eq(themeItems.id, id) })
}

// ─── Images ────────────────────────────────────────────────────────────────

export async function countThemeImages(themeId: string): Promise<number> {
  const rows = await db.query.themeImages.findMany({
    where: eq(themeImages.themeId, themeId),
    columns: { id: true },
  })
  return rows.length
}

export async function addThemeImage(data: ThemeImageInsert) {
  const [image] = await db.insert(themeImages).values(data).returning()
  return image
}

export async function getThemeImageById(id: string) {
  return db.query.themeImages.findFirst({ where: eq(themeImages.id, id) })
}

export async function deleteThemeImage(id: string): Promise<void> {
  await db.delete(themeImages).where(eq(themeImages.id, id))
}
