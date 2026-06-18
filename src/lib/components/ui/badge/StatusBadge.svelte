<script lang="ts" module>
  import type { BadgeVariant } from './badge.svelte'

  /** Variante par défaut selon le statut métier (absences, prêts, matériel, jeux). */
  const DEFAULT_VARIANTS: Record<string, BadgeVariant> = {
    en_attente: 'warning',
    approuve: 'success',
    actif: 'success',
    recu: 'success',
    achete: 'success',
    refuse: 'destructive',
    annule: 'destructive',
    retourne: 'secondary',
  }

  /** Libellé FR par défaut (surchargé au cas par cas via `labels`). */
  const DEFAULT_LABELS: Record<string, string> = {
    en_attente: 'En attente',
    approuve: 'Approuvée',
    actif: 'En prêt',
    recu: 'Reçu',
    achete: 'Acheté',
    refuse: 'Refusée',
    annule: 'Annulé',
    retourne: 'Retourné',
  }
</script>

<script lang="ts">
  import { Badge } from './index.js'

  let {
    status,
    labels = {},
    variantMap = {},
  }: {
    status: string
    labels?: Record<string, string>
    variantMap?: Record<string, BadgeVariant>
  } = $props()

  const variant = $derived(variantMap[status] ?? DEFAULT_VARIANTS[status] ?? 'outline')
  const label = $derived(labels[status] ?? DEFAULT_LABELS[status] ?? status)
</script>

<Badge {variant}>{label}</Badge>
