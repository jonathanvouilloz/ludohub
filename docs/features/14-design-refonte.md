# Feature : DESIGN — Refonte UI transversale (système de composants)

**Epic :** 14 (transversal) | **Taille :** L | **Statut :** DONE (itératif)

## Etat session 2026-06-17

**Fait :**

- **Système de boutons** (`ui/button`) refondu : variantes `outline` (blanc + bordure forte + ombre) et `ghost` (bordure forte transparente) rendues visibles ; `compoundVariants` retirant la bordure pour les boutons **icône-only** ; rayon unifié `rounded-lg` toutes tailles ; correction d'un bug de cascade Tailwind v4 (mapping `@theme` des radius/ombres était auto-référentiel → `border-radius: 0`).
- **Surfaces de données** : nouveaux composants `ui/data-table` (surface blanche + responsive → cartes < 640px) et `ui/data-card` (carte unifiée) ; **tous** les tableaux migrés (absences, prêts, check-ups, journal admin, membres, saisons) ; `SupplyCard`/`WishlistItem` réécrits en adaptateurs de `DataCard`.
- **Badges** : variantes sémantiques `success`/`warning` + composant `StatusBadge` (statut → couleur lisible) ; badge « Prochain » du planning passé en `<Badge>` primary.
- **Patterns** : `ui/collapsible-section` (jeux achetés / matériel reçu repliés par défaut) ; modales de confirmation `AlertDialog` sur suppressions (élément de thème, absence, **suppression définitive de thème** avec garde prêt/installation + nettoyage Blob) ; token typo `--text-card-title` (18px).
- **Bug fonctionnel** : notifications matériel — ajout de `supply_request` (enum `notificationType` + `SEVERITY` + `emitEvent` dans `createSupplyRequest` + domaine « Matériel »).
- **Doc** : conventions figées dans `docs/DESIGN.md §9` (composants & patterns établis) et `docs/STYLEGUIDE.md` (réutiliser DataTable/DataCard/StatusBadge/CollapsibleSection, règles boutons).

**Prochain :** ⚠️ **Lancer `pnpm db:push`** (Neon) pour appliquer la valeur d'enum Postgres `supply_request` — sans ça les notifs matériel ne s'enregistrent pas. Puis reprendre l'epic **12-TESTS E2E**.

**Pièges :**

- `@theme` (`src/app.css`) : **valeurs littérales** pour radius/ombres, jamais `var(--radius-lg)` auto-référentiel (casse silencieuse).
- Boutons icône-only : ne pas ajouter de bordure manuelle, le `compoundVariants` s'en charge.
- `.vercel/` généré par `pnpm build` local — ne pas committer (le build échoue à l'étape adapter sous Node 24, normal en local).

**Commit :** (à renseigner) feat(ui): système de composants — tableaux, cartes, badges, boutons

---

## Carte du code

> Mise a jour : 2026-06-17

| Fichier                                            | Role                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/components/ui/button/button.svelte`       | Variantes/ tailles ; `compoundVariants` icône-only sans bordure      |
| `src/lib/components/ui/badge/badge.svelte`         | Variantes `success`/`warning` ajoutées                               |
| `src/lib/components/ui/badge/StatusBadge.svelte`   | Mappe un statut métier → variante + libellé FR                       |
| `src/lib/components/ui/data-table/DataTable.svelte`| Tableau sur surface + bascule cartes < 640px (snippets head/body/cards) |
| `src/lib/components/ui/data-card/DataCard.svelte`  | Carte de données unifiée (titre/badge/notes/byline/actions)          |
| `src/lib/components/ui/collapsible-section/CollapsibleSection.svelte` | Section repliable `<details>` + chevron                |
| `src/app.css` / `src/styles/tokens.css`            | Mapping `@theme` (radius/ombres littéraux) + token `--text-card-title` |
| `src/lib/server/services/supplies.ts`              | `createSupplyRequest` émet `supply_request`                          |
| `src/lib/server/services/events.ts` / `notifications.ts` / `schema.ts` | Type/sévérité/domaine `supply_request`             |
| `src/lib/server/services/themes.ts` + `db/themes.ts` | `deleteThemeForLudo` (garde prêt/installation + cleanup Blob + cascade) |
| `src/routes/[ludo]/{absences,games,supplies,settings/membres,planning/saisons,themes/[id]}/+page.svelte` | Pages migrées vers DataTable/DataCard/CollapsibleSection |

### Decisions cles

- `ui/` héberge les primitives shadcn **et** les extensions maison validées (variantes, DataTable/DataCard/CollapsibleSection/StatusBadge) — source de référence, cf. `DESIGN.md §9`.
- Palette très claire → aucun bouton texte sans repère visuel (bordure forte) ; les icônes restent sans bordure.
- DataCard reste **présentationnel** ; la logique métier vit dans les adaptateurs domaine (`SupplyCard`, `WishlistItem`).
