import { and, asc, eq } from 'drizzle-orm'
import { db } from './index.js'
import {
  ludoSites,
  siteOpeningIntervals,
  type LudoSiteInsert,
  type SiteOpeningIntervalInsert,
} from '../schema.js'

export type SiteUpdateData = Partial<
  Pick<
    LudoSiteInsert,
    | 'name'
    | 'address'
    | 'postalCode'
    | 'city'
    | 'phone'
    | 'email'
    | 'accessInfo'
    | 'latitude'
    | 'longitude'
    | 'isPrimary'
    | 'isActive'
    | 'sortOrder'
  >
>

export async function listSiteRowsWithOpeningHours(ludoId: string) {
  return db.query.ludoSites.findMany({
    where: eq(ludoSites.ludoId, ludoId),
    with: {
      openingIntervals: {
        orderBy: [
          asc(siteOpeningIntervals.dayOfWeek),
          asc(siteOpeningIntervals.sortOrder),
          asc(siteOpeningIntervals.opensAt),
        ],
      },
    },
    orderBy: [asc(ludoSites.sortOrder), asc(ludoSites.name)],
  })
}

export async function listActiveSiteRows(ludoId: string) {
  return db.query.ludoSites.findMany({
    where: and(eq(ludoSites.ludoId, ludoId), eq(ludoSites.isActive, true)),
    orderBy: [asc(ludoSites.sortOrder), asc(ludoSites.name)],
  })
}

export async function getSiteRowForLudo(siteId: string, ludoId: string) {
  return db.query.ludoSites.findFirst({
    where: and(eq(ludoSites.id, siteId), eq(ludoSites.ludoId, ludoId)),
    with: {
      openingIntervals: {
        orderBy: [
          asc(siteOpeningIntervals.dayOfWeek),
          asc(siteOpeningIntervals.sortOrder),
          asc(siteOpeningIntervals.opensAt),
        ],
      },
    },
  })
}

export async function insertSiteWithIntervalsAtomic(
  data: LudoSiteInsert & { id: string },
  intervals: Array<
    Pick<SiteOpeningIntervalInsert, 'dayOfWeek' | 'opensAt' | 'closesAt' | 'sortOrder'>
  >,
  makePrimary: boolean,
) {
  const clearPrimary = db
    .update(ludoSites)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(eq(ludoSites.ludoId, data.ludoId))
  const insertSite = db.insert(ludoSites).values({ ...data, isPrimary: makePrimary })
  const insertIntervals = () =>
    db
      .insert(siteOpeningIntervals)
      .values(intervals.map((interval) => ({ ...interval, siteId: data.id, ludoId: data.ludoId })))
  if (makePrimary && intervals.length) await db.batch([clearPrimary, insertSite, insertIntervals()])
  else if (makePrimary) await db.batch([clearPrimary, insertSite])
  else if (intervals.length) await db.batch([insertSite, insertIntervals()])
  else await insertSite
}

export async function updateSiteWithIntervalsAtomic(
  siteId: string,
  ludoId: string,
  data: SiteUpdateData,
  intervals: Array<
    Pick<SiteOpeningIntervalInsert, 'dayOfWeek' | 'opensAt' | 'closesAt' | 'sortOrder'>
  >,
  makePrimary: boolean,
) {
  const clearPrimary = db
    .update(ludoSites)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(eq(ludoSites.ludoId, ludoId))
  const updateSite = db
    .update(ludoSites)
    .set({ ...data, isPrimary: makePrimary, updatedAt: new Date() })
    .where(and(eq(ludoSites.id, siteId), eq(ludoSites.ludoId, ludoId)))
  const removeIntervals = db
    .delete(siteOpeningIntervals)
    .where(and(eq(siteOpeningIntervals.siteId, siteId), eq(siteOpeningIntervals.ludoId, ludoId)))
  const insertIntervals = () =>
    db
      .insert(siteOpeningIntervals)
      .values(intervals.map((interval) => ({ ...interval, siteId, ludoId })))
  if (makePrimary && intervals.length) {
    await db.batch([clearPrimary, updateSite, removeIntervals, insertIntervals()])
  } else if (makePrimary) {
    await db.batch([clearPrimary, updateSite, removeIntervals])
  } else if (intervals.length) {
    await db.batch([updateSite, removeIntervals, insertIntervals()])
  } else {
    await db.batch([updateSite, removeIntervals])
  }
}

/** Réordonne atomiquement l'ensemble validé par le service, toujours sous le tenant. */
export async function updateSiteOrderRows(ludoId: string, orderedIds: string[]) {
  if (orderedIds.length === 0) return
  const [firstId, ...remainingIds] = orderedIds
  const firstQuery = db
    .update(ludoSites)
    .set({ sortOrder: 0, updatedAt: new Date() })
    .where(and(eq(ludoSites.id, firstId), eq(ludoSites.ludoId, ludoId)))
  const remainingQueries = remainingIds.map((id, index) =>
    db
      .update(ludoSites)
      .set({ sortOrder: index + 1, updatedAt: new Date() })
      .where(and(eq(ludoSites.id, id), eq(ludoSites.ludoId, ludoId))),
  )
  await db.batch([firstQuery, ...remainingQueries])
}
