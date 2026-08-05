import type { AttendanceRow, LudoSiteRow } from './schema.js'

/** Format sérialisable consommé par l'UI fréquentation. `id` est la valeur canonique. */
export type SiteOption = { id: string; slug: string; label: string }

export function toSiteOptions(sites: LudoSiteRow[]): SiteOption[] {
  return sites.map((site) => ({ id: site.id, slug: site.slug, label: site.name }))
}

/**
 * Résout un relevé pendant la transition site texte → site_id.
 * L'UUID prévaut ; le slug historique reste lisible tant que toutes les lignes
 * et toutes les anciennes versions de l'app ne sont pas migrées.
 */
export function attendanceSiteOption(
  record: Pick<AttendanceRow, 'siteId' | 'site'>,
  sites: SiteOption[],
): SiteOption | undefined {
  return sites.find(
    (candidate) =>
      candidate.id === record.siteId || (!record.siteId && candidate.slug === record.site),
  )
}
