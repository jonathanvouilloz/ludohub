import { eq } from 'drizzle-orm'
import { db } from './index.js'
import { publicSiteSettings } from '../schema.js'

export async function getPublicSiteSettingsRow(ludoId: string) {
  return db.query.publicSiteSettings.findFirst({
    where: eq(publicSiteSettings.ludoId, ludoId),
  })
}

/** Upsert strictement indexé par ludo : aucune activation globale implicite. */
export async function setPublicSiteEnabledRow(ludoId: string, enabled: boolean, updatedAt: Date) {
  const [row] = await db
    .insert(publicSiteSettings)
    .values({ ludoId, enabled, updatedAt })
    .onConflictDoUpdate({
      target: publicSiteSettings.ludoId,
      set: { enabled, updatedAt },
    })
    .returning()
  return row
}
