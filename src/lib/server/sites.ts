/**
 * Configuration « en dur » des ludothèques multi-sites.
 *
 * Cas unique et volontairement codé en dur : l'équipe de la ludothèque fusionnée
 * Pâquis-Sécheron opère physiquement sur deux sites mais saisit la fréquentation
 * dans un seul espace membre. On tague donc chaque relevé par site. Aucune autre
 * ludo n'est concernée ; le jour où ce besoin se reproduirait, il suffit d'ajouter
 * une entrée ici (ou de migrer vers une vraie table).
 *
 * Module server-only : importé par le service de fréquentation et le `+page.server.ts`.
 * Le client ne l'importe jamais — la liste `sites` lui est passée via `data` du load.
 */

export type SiteOption = { value: string; label: string }

const MULTI_SITE: Record<string, SiteOption[]> = {
  'paquis-secheron': [
    { value: 'paquis', label: 'Pâquis' },
    { value: 'secheron', label: 'Sécheron' },
  ],
}

/** Liste des sites d'une ludo, ou `null` si elle est mono-site (cas général). */
export function getSitesForSlug(slug: string): SiteOption[] | null {
  return MULTI_SITE[slug] ?? null
}

/**
 * Libellé d'affichage d'un site pour une ludo donnée.
 * `null` (séance non répartie) → `null` : l'appelant affiche « Non réparti ».
 */
export function siteLabel(slug: string, value: string | null): string | null {
  if (value == null) return null
  const sites = MULTI_SITE[slug]
  return sites?.find((s) => s.value === value)?.label ?? value
}
