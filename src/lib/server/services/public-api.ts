import { getLudoBySlug } from '../db/ludotheques.js'
import { listSiteRowsWithOpeningHours } from '../db/sites.js'
import { isPublicSiteEnabled } from './public-site.js'
import { listVisiblePublicAnnouncements } from './public-announcements.js'

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
