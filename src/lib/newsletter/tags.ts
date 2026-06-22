import type { BadgeVariant } from '$lib/components/ui/badge/badge.svelte'

/**
 * Segments de contacts newsletter (un seul tag par contact ; `null` = non classé).
 * Module client-safe : ordre d'affichage + libellés + variantes de badge.
 * La validation côté serveur s'appuie sur l'enum DB (`newsletterContactTag`).
 */
export const CONTACT_TAGS = ['famille', 'institution', 'partenaire', 'autre'] as const

export type ContactTag = (typeof CONTACT_TAGS)[number]

export const TAG_LABELS: Record<ContactTag, string> = {
  famille: 'Famille',
  institution: 'Institution',
  partenaire: 'Partenaire',
  autre: 'Autre',
}

export const TAG_VARIANTS: Record<ContactTag, BadgeVariant> = {
  famille: 'success',
  institution: 'secondary',
  partenaire: 'warning',
  autre: 'outline',
}
