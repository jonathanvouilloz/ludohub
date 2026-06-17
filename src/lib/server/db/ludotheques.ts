import { eq, ne } from 'drizzle-orm'
import { db } from './index.js'
import { ludotheques, type LudothequeInsert, type LudothequeRow } from '../schema.js'

export async function getLudoBySlug(slug: string): Promise<LudothequeRow | undefined> {
  return db.query.ludotheques.findFirst({ where: eq(ludotheques.slug, slug) })
}

export async function getLudoById(id: string): Promise<LudothequeRow | undefined> {
  return db.query.ludotheques.findFirst({ where: eq(ludotheques.id, id) })
}

export async function getAllLudos(): Promise<LudothequeRow[]> {
  return db.query.ludotheques.findMany({ orderBy: (l, { asc }) => asc(l.name) })
}

export async function getOtherLudos(excludeLudoId: string): Promise<LudothequeRow[]> {
  return db.query.ludotheques.findMany({
    where: ne(ludotheques.id, excludeLudoId),
    orderBy: (l, { asc }) => asc(l.name),
  })
}

export async function createLudo(data: LudothequeInsert): Promise<LudothequeRow> {
  const [ludo] = await db.insert(ludotheques).values(data).returning()
  return ludo
}

export async function updateLudoById(
  id: string,
  data: Partial<LudothequeInsert>,
): Promise<LudothequeRow> {
  const [ludo] = await db.update(ludotheques).set(data).where(eq(ludotheques.id, id)).returning()
  return ludo
}
