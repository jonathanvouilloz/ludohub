import { and, desc, eq } from 'drizzle-orm'
import { db } from './index.js'
import { activityLog, type ActivityLogInsert, type ActivityLogRow } from '../schema.js'

/** Écrit une ligne d'audit (append-only). Alimenté par le dispatcher d'événements. */
export async function insertActivity(data: ActivityLogInsert): Promise<ActivityLogRow> {
  const [row] = await db.insert(activityLog).values(data).returning()
  return row
}

/**
 * Journal d'activité global (super-admin), du plus récent au plus ancien.
 * Filtres optionnels par ludo et/ou par action.
 */
export async function getGlobalActivityLog(
  opts: {
    limit?: number
    ludoId?: string
    action?: string
  } = {},
): Promise<ActivityLogRow[]> {
  const filters = [
    opts.ludoId ? eq(activityLog.ludoId, opts.ludoId) : undefined,
    opts.action ? eq(activityLog.action, opts.action) : undefined,
  ].filter(Boolean)

  return db.query.activityLog.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy: desc(activityLog.createdAt),
    limit: opts.limit ?? 200,
  })
}
