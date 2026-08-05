import { getLudoBySlug } from '../db/ludotheques.js'
import { listSiteRowsWithOpeningHours } from '../db/sites.js'
import { isPublicSiteEnabled } from './public-site.js'
import { listVisiblePublicAnnouncements } from './public-announcements.js'
import { getVisiblePublicNewsBySlug, listVisiblePublicNewsSummaries } from './public-news.js'
import {
  getVisiblePublicActivityBySlug,
  listArchivedPublicActivitySummaries,
  listVisiblePublicActivitySummaries,
} from './public-activities.js'
import {
  getVisiblePublicTopThreeBySlug,
  listVisiblePublicTopThreeSummaries,
} from './public-top-threes.js'
import { listVisiblePublicFaqs } from './public-faqs.js'
import { getVisiblePublicDocumentBySlug, listVisiblePublicDocuments } from './public-documents.js'

export type PublicOpeningInterval = {
  dayOfWeek: number
  opensAt: string
  closesAt: string
}

export type PublicLudoSite = {
  id: string
  slug: string
  name: string
  address: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
  accessInfo: string | null
  latitude: number | null
  longitude: number | null
  isPrimary: boolean
  sortOrder: number
  openingIntervals: PublicOpeningInterval[]
}

export type PublicSitesPayload = {
  ludo: { slug: string; name: string }
  sites: PublicLudoSite[]
}

export type PublicAnnouncementItem = {
  id: string
  title: string
  message: string
  publishedAt: string
  sites: Array<{ id: string; slug: string; name: string }>
}

export type PublicAnnouncementsPayload = {
  ludo: { slug: string; name: string }
  site: string | null
  announcements: PublicAnnouncementItem[]
}

export type PublicNewsSummaryItem = {
  id: string
  slug: string
  title: string
  summary: string
  image: { url: string; alt: string } | null
  publishedAt: string
}

export type PublicNewsItem = PublicNewsSummaryItem & {
  bodyMarkdown: string
  sites: Array<{ id: string; slug: string; name: string }>
}

export type PublicNewsPayload = {
  ludo: { slug: string; name: string }
  site: string | null
  news: PublicNewsSummaryItem[]
}

export type PublicActivitySchedule = {
  type: 'one_off' | 'recurring' | 'permanent'
  recurrenceRule: string | null
  dates: Array<{ startsAt: string; endsAt: string | null }>
  exceptions: Array<{ excludedAt: string; reason: string | null }>
}

export type PublicActivitySchedulePreview = Omit<PublicActivitySchedule, 'exceptions'>

export type PublicActivitySummaryItem = {
  id: string
  slug: string
  title: string
  summary: string
  location: string | null
  image: { url: string; alt: string } | null
  lifecycle: 'active' | 'archived'
  featuredRank: number | null
  publishedAt: string
  schedule: PublicActivitySchedulePreview
}

export type PublicActivityItem = Omit<PublicActivitySummaryItem, 'schedule'> & {
  bodyMarkdown: string
  schedule: PublicActivitySchedule
}

export type PublicActivitiesPayload = {
  ludo: { slug: string; name: string }
  site: string | null
  timeZone: 'Europe/Zurich'
  activities: PublicActivitySummaryItem[]
}

export type PublicTopThreeSummaryItem = {
  id: string
  slug: string
  theme: string
  games: Array<{ name: string }>
  publishedAt: string
}

export type PublicTopThreeItem = Omit<PublicTopThreeSummaryItem, 'games'> & {
  games: Array<{ name: string; description: string | null }>
  sites: Array<{ id: string; slug: string; name: string }>
}

export type PublicTopThreesPayload = {
  ludo: { slug: string; name: string }
  site: string | null
  topThrees: PublicTopThreeSummaryItem[]
}

export type PublicFaqItem = {
  id: string
  question: string
  answerMarkdown: string
  category: string | null
  sortOrder: number
}

export type PublicFaqsPayload = {
  ludo: { slug: string; name: string }
  site: string | null
  faqs: PublicFaqItem[]
}

export type PublicDocumentSummaryItem = {
  id: string
  slug: string
  kind: 'mission' | 'statutes' | 'annual_report' | 'other'
  title: string
  summary: string | null
  year: number | null
  pdf: { url: string; fileName: string } | null
  publishedAt: string
}

export type PublicDocumentItem = PublicDocumentSummaryItem & {
  bodyMarkdown: string | null
  sites: Array<{ id: string; slug: string; name: string }>
}

export type PublicDocumentsPayload = {
  ludo: { slug: string; name: string }
  site: string | null
  documents: PublicDocumentSummaryItem[]
}

function publicTime(value: string): string {
  return value.slice(0, 5)
}

/** Retourne null pour un slug inconnu comme pour un module désactivé, sans révéler le tenant. */
export async function getPublicSitesByLudoSlug(slug: string): Promise<PublicSitesPayload | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null

  const sites = (await listSiteRowsWithOpeningHours(ludo.id))
    .filter((site) => site.isActive)
    .map((site) => ({
      id: site.id,
      slug: site.slug,
      name: site.name,
      address: site.address,
      postalCode: site.postalCode,
      city: site.city,
      phone: site.phone,
      email: site.email,
      accessInfo: site.accessInfo,
      latitude: site.latitude,
      longitude: site.longitude,
      isPrimary: site.isPrimary,
      sortOrder: site.sortOrder,
      openingIntervals: site.openingIntervals.map((interval) => ({
        dayOfWeek: interval.dayOfWeek,
        opensAt: publicTime(interval.opensAt),
        closesAt: publicTime(interval.closesAt),
      })),
    }))

  return { ludo: { slug: ludo.slug, name: ludo.name }, sites }
}

/** Résout les slugs publics avant de déléguer le filtrage tenant/cibles au service éditorial. */
export async function getPublicAnnouncementsByLudoSlug(
  slug: string,
  siteSlug?: string,
): Promise<PublicAnnouncementsPayload | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null

  let siteId: string | undefined
  if (siteSlug) {
    const site = (await listSiteRowsWithOpeningHours(ludo.id)).find(
      (candidate) => candidate.isActive && candidate.slug === siteSlug,
    )
    if (!site) return null
    siteId = site.id
  }

  const rows = await listVisiblePublicAnnouncements(ludo.id, siteId)
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    announcements: rows.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      publishedAt: announcement.publishedAt!.toISOString(),
      sites: announcement.targets
        .filter((target) => target.site.isActive)
        .map((target) => ({
          id: target.site.id,
          slug: target.site.slug,
          name: target.site.name,
        })),
    })),
  }
}

function publicNewsSummaryItem(
  news: Awaited<ReturnType<typeof listVisiblePublicNewsSummaries>>[number],
): PublicNewsSummaryItem {
  return {
    id: news.id,
    slug: news.slug,
    title: news.title,
    summary: news.summary,
    image:
      news.imageUrl && news.imageAlt
        ? {
            url: news.imageUrl,
            alt: news.imageAlt,
          }
        : null,
    publishedAt: news.publishedAt!.toISOString(),
  }
}

function publicNewsDetailItem(
  news: NonNullable<Awaited<ReturnType<typeof getVisiblePublicNewsBySlug>>>,
): PublicNewsItem {
  return {
    ...publicNewsSummaryItem(news),
    bodyMarkdown: news.body,
    sites: news.targets
      .filter((target) => target.site.isActive)
      .map((target) => ({ id: target.site.id, slug: target.site.slug, name: target.site.name })),
  }
}

async function resolvePublicSiteId(ludoId: string, siteSlug?: string) {
  if (!siteSlug) return { siteId: undefined }
  const site = (await listSiteRowsWithOpeningHours(ludoId)).find(
    (candidate) => candidate.isActive && candidate.slug === siteSlug,
  )
  return site ? { siteId: site.id } : null
}

export async function getPublicNewsByLudoSlug(
  slug: string,
  siteSlug?: string,
  limit = 20,
): Promise<PublicNewsPayload | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null

  const rows = await listVisiblePublicNewsSummaries(ludo.id, resolvedSite.siteId, limit)
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    news: rows.map(publicNewsSummaryItem),
  }
}

export async function getPublicNewsDetailByLudoSlug(
  slug: string,
  newsSlug: string,
  siteSlug?: string,
): Promise<(Omit<PublicNewsPayload, 'news'> & { news: PublicNewsItem }) | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null

  const news = await getVisiblePublicNewsBySlug(ludo.id, newsSlug, resolvedSite.siteId)
  if (!news) return null
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    news: publicNewsDetailItem(news),
  }
}

type PublicActivityRow = Awaited<ReturnType<typeof listVisiblePublicActivitySummaries>>[number]

function publicActivitySummaryItem(activity: PublicActivityRow): PublicActivitySummaryItem {
  return {
    id: activity.id,
    slug: activity.slug,
    title: activity.title,
    summary: activity.summary,
    location: activity.location,
    image:
      activity.imageUrl && activity.imageAlt
        ? { url: activity.imageUrl, alt: activity.imageAlt }
        : null,
    lifecycle: activity.lifecycle as 'active' | 'archived',
    featuredRank: activity.featuredRank,
    publishedAt: activity.publishedAt!.toISOString(),
    schedule: {
      type: activity.type,
      recurrenceRule: activity.recurrenceRule,
      dates: activity.dates.map((date) => ({
        startsAt: date.startsAt,
        endsAt: date.endsAt,
      })),
    },
  }
}

async function getPublicActivitiesByLifecycle(
  slug: string,
  lifecycle: 'active' | 'archived',
  siteSlug?: string,
  limit = 20,
): Promise<PublicActivitiesPayload | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null
  const list =
    lifecycle === 'active'
      ? listVisiblePublicActivitySummaries
      : listArchivedPublicActivitySummaries
  const rows = await list(ludo.id, resolvedSite.siteId, limit)
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    timeZone: 'Europe/Zurich',
    activities: rows.map(publicActivitySummaryItem),
  }
}

export function getPublicActivitiesByLudoSlug(slug: string, siteSlug?: string, limit = 20) {
  return getPublicActivitiesByLifecycle(slug, 'active', siteSlug, limit)
}

export function getArchivedPublicActivitiesByLudoSlug(slug: string, siteSlug?: string, limit = 20) {
  return getPublicActivitiesByLifecycle(slug, 'archived', siteSlug, limit)
}

export async function getPublicActivityDetailByLudoSlug(
  slug: string,
  activitySlug: string,
  siteSlug?: string,
): Promise<
  (Omit<PublicActivitiesPayload, 'activities'> & { activity: PublicActivityItem }) | null
> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null
  const activity = await getVisiblePublicActivityBySlug(ludo.id, activitySlug, resolvedSite.siteId)
  if (!activity) return null
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    timeZone: 'Europe/Zurich',
    activity: {
      id: activity.id,
      slug: activity.slug,
      title: activity.title,
      summary: activity.summary,
      location: activity.location,
      image:
        activity.imageUrl && activity.imageAlt
          ? { url: activity.imageUrl, alt: activity.imageAlt }
          : null,
      lifecycle: activity.lifecycle as 'active' | 'archived',
      featuredRank: activity.featuredRank,
      publishedAt: activity.publishedAt!.toISOString(),
      bodyMarkdown: activity.body,
      schedule: {
        type: activity.type,
        recurrenceRule: activity.recurrenceRule,
        dates: activity.dates.map((date) => ({
          startsAt: date.startsAt.toISOString(),
          endsAt: date.endsAt?.toISOString() ?? null,
        })),
        exceptions: activity.exceptions.map((exception) => ({
          excludedAt: exception.excludedAt.toISOString(),
          reason: exception.reason,
        })),
      },
    },
  }
}

export async function getPublicTopThreesByLudoSlug(
  slug: string,
  siteSlug?: string,
  limit = 20,
): Promise<PublicTopThreesPayload | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null
  const rows = await listVisiblePublicTopThreeSummaries(ludo.id, resolvedSite.siteId, limit)
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    topThrees: rows.map((item) => ({
      id: item.id,
      slug: item.slug,
      theme: item.theme,
      games: item.games,
      publishedAt: item.publishedAt!.toISOString(),
    })),
  }
}

export async function getPublicTopThreeDetailByLudoSlug(
  slug: string,
  topThreeSlug: string,
  siteSlug?: string,
): Promise<(Omit<PublicTopThreesPayload, 'topThrees'> & { topThree: PublicTopThreeItem }) | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null
  const item = await getVisiblePublicTopThreeBySlug(ludo.id, topThreeSlug, resolvedSite.siteId)
  if (!item) return null
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    topThree: {
      id: item.id,
      slug: item.slug,
      theme: item.theme,
      games: item.games.map((game) => ({
        name: game.name,
        description: game.description ?? null,
      })),
      publishedAt: item.publishedAt!.toISOString(),
      sites: item.targets
        .filter((target) => target.site.isActive)
        .map((target) => ({
          id: target.site.id,
          slug: target.site.slug,
          name: target.site.name,
        })),
    },
  }
}

export async function getPublicFaqsByLudoSlug(
  slug: string,
  siteSlug?: string,
  limit = 100,
): Promise<PublicFaqsPayload | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null
  const rows = await listVisiblePublicFaqs(ludo.id, resolvedSite.siteId, limit)
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    faqs: rows.map((faq) => ({
      id: faq.id,
      question: faq.question,
      answerMarkdown: faq.answerMarkdown,
      category: faq.category,
      sortOrder: faq.sortOrder,
    })),
  }
}

function publicDocumentSummaryItem(
  item: Awaited<ReturnType<typeof listVisiblePublicDocuments>>[number],
): PublicDocumentSummaryItem {
  return {
    id: item.id,
    slug: item.slug,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    year: item.year,
    pdf: item.pdfUrl && item.pdfFileName ? { url: item.pdfUrl, fileName: item.pdfFileName } : null,
    publishedAt: item.publishedAt!.toISOString(),
  }
}

export async function getPublicDocumentsByLudoSlug(
  slug: string,
  siteSlug?: string,
  limit = 20,
): Promise<PublicDocumentsPayload | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null
  const rows = await listVisiblePublicDocuments(ludo.id, resolvedSite.siteId, limit)
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    documents: rows.map(publicDocumentSummaryItem),
  }
}

export async function getPublicDocumentDetailByLudoSlug(
  slug: string,
  documentSlug: string,
  siteSlug?: string,
): Promise<(Omit<PublicDocumentsPayload, 'documents'> & { document: PublicDocumentItem }) | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo || !(await isPublicSiteEnabled(ludo.id))) return null
  const resolvedSite = await resolvePublicSiteId(ludo.id, siteSlug)
  if (!resolvedSite) return null
  const item = await getVisiblePublicDocumentBySlug(ludo.id, documentSlug, resolvedSite.siteId)
  if (!item) return null
  return {
    ludo: { slug: ludo.slug, name: ludo.name },
    site: siteSlug ?? null,
    document: {
      ...publicDocumentSummaryItem(item),
      bodyMarkdown: item.bodyMarkdown,
      sites: item.targets
        .filter((target) => target.site.isActive)
        .map((target) => ({
          id: target.site.id,
          slug: target.site.slug,
          name: target.site.name,
        })),
    },
  }
}
