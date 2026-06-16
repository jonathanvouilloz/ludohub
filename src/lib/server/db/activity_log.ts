import { db } from './index.js'
import { activityLog, type ActivityLogInsert, type ActivityLogRow } from '../schema.js'

/** Écrit une ligne d'audit (append-only). Alimenté par le dispatcher d'événements. */
export async function insertActivity(data: ActivityLogInsert): Promise<ActivityLogRow> {
  const [row] = await db.insert(activityLog).values(data).returning()
  return row
}
