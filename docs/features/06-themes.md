# Feature : THÈMES — Catalogue, partage et prêts

**Epic :** 06 | **Taille :** L | **Statut :** DONE

## Etat session 2026-06-16

**Fait :**

- Relations Drizzle (themes/items/images/loans) + types ajoutés dans `schema.ts` (débloque les `with`)
- Couche DB (`db/themes.ts`, `db/loans.ts`, `getOtherLudos`) + services (`services/themes.ts`, `services/loans.ts`)
- Endpoint upload Vercel Blob `api/themes/[id]/images` (POST/DELETE, MIME serveur + 5 Mo + max 3) ; helper `requireSessionContext`
- Pages thèmes (liste, new, fiche [id]) + catalogue réseau `/reseau/themes` + 5 composants ; lien nav
- Fixes UI : boutons-liens lisibles (`app.css`), inputs blancs (`input.svelte`), checkbox partage cochée par défaut
- Seed 2ᵉ ludo (servette) ; 15 tests unitaires verts + e2e push-loan ; `pnpm check`/`lint` clean

**Prochain :** Epic terminé. Démarrer **07-RÉSEAU** (demandes d'aide cross-ludo) — y inclure le flow pull/request des prêts (`requestTheme`/`confirmLoanRequest`, statut `en_attente`) reporté depuis 06.
**Pièges :** En Tailwind v4, les règles globales hors `@layer` (ex. `a {}` dans `app.css`) priment sur les utilitaires → scoper avec `:not([data-slot='button'])`. Flow pull volontairement non implémenté (enum `loan_status` inchangé).
**Commit :** feat(themes): catalogue, items, photos Blob, prêts push + fixes UI

---

## Carte du code

> Mise a jour : 2026-06-16

| Fichier                                          | Role                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `src/lib/server/schema.ts`                       | Relations + types thèmes/prêts (tables déjà créées, pas de `db:push`)   |
| `src/lib/server/db/themes.ts`                    | Queries thèmes (liste, fiche, items, images, partage réseau)            |
| `src/lib/server/db/loans.ts`                     | Queries prêts (prêt actif, création, retour, historique)                |
| `src/lib/server/services/themes.ts`              | Logique thèmes : CRUD, items, images (max 3), catalogue réseau          |
| `src/lib/server/services/loans.ts`              | Logique prêts push : `loanTheme` (refus si actif/auto), `returnTheme`   |
| `src/lib/server/ludo-context.ts`                 | `requireSessionContext` : contexte ludo via session (routes `/reseau`)  |
| `src/routes/api/themes/[id]/images/+server.ts`   | Upload/suppression photos Vercel Blob (MIME serveur, 5 Mo, max 3)       |
| `src/routes/[ludo]/themes/[id]/+page.server.ts`  | Orchestration fiche : édition, items, partage, prêt, retour, archive    |
| `src/routes/reseau/themes/+page.server.ts`       | Catalogue réseau (lecture seule, thèmes partagés des autres ludos)      |
| `src/lib/components/themes/`                      | ThemeCard, ThemeItemList, ThemeImageGallery, LoanDialog, NetworkThemeCard |
| `src/lib/server/db/seed.ts`                       | Seed 2 ludos (paquis + servette) pour tester les prêts cross-ludo       |

### Decisions cles

- **Prêts push uniquement** dans 06 ; le flow pull/request (`en_attente`) est reporté à 07-RÉSEAU → enum `loan_status` laissé inchangé (`actif/retourne/annule`).
- **Tous les membres actifs** gèrent les thèmes (actions via `requireLudoContext`, pas responsable).
- Routes `/reseau/*` sans param `[ludo]` → contexte résolu depuis la session (`requireSessionContext`).
- Tailwind v4 : règles CSS globales hors `@layer` priment sur les utilitaires (gotcha boutons-liens).

## Description

Gestion des thèmes (boîtes d'activités) de chaque ludo. Catalogue interne, partage dans le réseau, upload de photos via Vercel Blob, système de prêts push (ludo prête à une autre) et pull (ludo emprunte depuis le réseau).

## Tâches

> **Décisions epic 06** : prêts **push uniquement** (le flow pull/request
> `requestTheme`/`confirmLoanRequest` est reporté à **07-RÉSEAU**) ; **tous les
> membres actifs** peuvent créer/modifier/archiver les thèmes et gérer photos +
> prêts (actions via `requireLudoContext`, pas responsable). Tables DB déjà créées
> (pas de `db:push`) ; relations Drizzle ajoutées dans `schema.ts`.

### Pages

- [x] `src/routes/[ludo]/themes/+page.svelte` — liste des thèmes de la ludo
- [x] `src/routes/[ludo]/themes/[id]/+page.svelte` — fiche thème (items + photos + historique prêts)
- [x] `src/routes/[ludo]/themes/new/+page.svelte` — création thème
- [x] `src/routes/reseau/themes/+page.svelte` — catalogue réseau (lecture seule, `is_shareable: true`)

### Services

- [x] `src/lib/server/services/themes.ts`
  - `createThemeForLudo`, `editTheme`, `setThemeShareable`, `archiveTheme`
  - `addItem`, `removeItem`
  - `registerImage` (max 3), `getImageForDeletion` + `unregisterImage`
  - `listThemes`, `getThemeDetail`, `getNetworkThemes`
- [x] `src/lib/server/services/loans.ts`
  - `loanTheme(themeId, fromLudoId, toLudoId, note?)` → ThemeLoanRow (refus si prêt actif / cible invalide)
  - `returnTheme(loanId, ludoId)` → void
  - ~~`requestTheme` / `confirmLoanRequest`~~ → reportés à **07-RÉSEAU** (flow pull)
  - historique : `getLoanHistory` (db/loans.ts) + relation `loans` sur la fiche

### DB queries

- [x] `src/lib/server/db/themes.ts`
- [x] `src/lib/server/db/loans.ts` (+ `getOtherLudos` dans `db/ludotheques.ts`)

### Upload Vercel Blob

- [x] `src/routes/api/themes/[id]/images/+server.ts` — endpoint upload (POST) + suppression (DELETE)
  - Contexte session via `requireSessionContext` ; thème vérifié appartenir à la ludo
  - Max 3 photos par thème (service `registerImage`)
  - Formats : jpg/png/webp, MIME validé serveur ; taille max 5 MB
  - `put()` vers Vercel Blob → URL + `storageKey` (pathname) en DB ; `del()` à la suppression

### Composants

- [x] `ThemeCard.svelte` — carte thème pour la liste
- [x] `ThemeItemList.svelte` — liste des items avec quantités (add/remove)
- [x] `ThemeImageGallery.svelte` — galerie 3 photos max (upload/suppression via l'endpoint)
- [x] `LoanDialog.svelte` — prêt push vers une ludo
- [x] `NetworkThemeCard.svelte` — carte dans le catalogue réseau
- [~] `ThemeDetail.svelte` — rendu inline dans `[id]/+page.svelte` (composant dédié non nécessaire)

## Edge cases

- Un thème ne peut pas être prêté si un prêt actif existe déjà
- Max 3 photos : bouton upload désactivé si atteint
- Thème archivé : lisible mais non modifiable, non visible dans le réseau
- Upload : vérifier MIME côté serveur, pas seulement l'extension

## Critères d'acceptation

- [x] Upload max 3 photos, formats jpg/png/webp, 5MB max
- [x] Prêt impossible si prêt actif existe
- [x] Historique des prêts visible sur la fiche
- [x] Thèmes archivables

## Playwright tests

- [x] Prêter un thème à une autre ludo (push) — `e2e/themes.spec.ts` (nécessite seed 2 ludos)
- [~] Voir le thème marqué "En prêt" : badge présent dans le catalogue réseau + sur la fiche propriétaire

## Tests unitaires

- [x] `services/themes.test.ts` (max 3 photos, archivé bloque, quantité/nom invalides)
- [x] `services/loans.test.ts` (prêt actif unique, auto-prêt refusé, retour)
