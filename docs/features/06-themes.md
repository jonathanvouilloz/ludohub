# Feature : THÈMES — Catalogue, partage et prêts

**Epic :** 06 | **Taille :** L | **Statut :** TODO

## Description

Gestion des thèmes (boîtes d'activités) de chaque ludo. Catalogue interne, partage dans le réseau, upload de photos via Vercel Blob, système de prêts push (ludo prête à une autre) et pull (ludo emprunte depuis le réseau).

## Tâches

### Pages

- [ ] `src/routes/[ludo]/themes/+page.svelte` — liste des thèmes de la ludo
- [ ] `src/routes/[ludo]/themes/[id]/+page.svelte` — fiche thème (items + photos + historique prêts)
- [ ] `src/routes/[ludo]/themes/new/+page.svelte` — création thème
- [ ] `src/routes/reseau/themes/+page.svelte` — catalogue réseau (tous les thèmes `is_shareable: true`)

### Services

- [ ] `src/lib/server/services/themes.ts`
  - `createTheme(ludoId, data)` → ThemeRow
  - `updateTheme(id, data)` → ThemeRow
  - `archiveTheme(id)` → void
  - `addThemeItem(themeId, data)` → ThemeItemRow
  - `removeThemeItem(id)` → void
  - `uploadThemeImage(themeId, file)` → ThemeImageRow (Vercel Blob)
  - `deleteThemeImage(id)` → void (delete from Blob + DB)
  - `getNetworkThemes()` → { theme, ludo, currentLoan }[]
- [ ] `src/lib/server/services/loans.ts`
  - `loanTheme(themeId, fromLudoId, toLudoId, note?)` → LoanRow
  - `returnTheme(loanId)` → void
  - `requestTheme(themeId, requestingLudoId)` → LoanRow (status: pending)
  - `confirmLoanRequest(loanId)` → LoanRow (status: active)
  - `getLoanHistory(themeId)` → LoanRow[]

### DB queries

- [ ] `src/lib/server/db/themes.ts`
- [ ] `src/lib/server/db/loans.ts`

### Upload Vercel Blob

- [ ] `src/routes/api/themes/[id]/images/+server.ts` — endpoint upload
  - Vérifier que le thème appartient à la ludo de la session
  - Vérifier max 3 photos par thème
  - Formats acceptés : jpg, png, webp
  - Taille max : 5MB
  - `put()` vers Vercel Blob → stocker URL + storage_key en DB

### Composants

- [ ] `ThemeCard.svelte` — carte thème pour la liste
- [ ] `ThemeDetail.svelte` — vue détaillée
- [ ] `ThemeItemList.svelte` — liste des items avec quantités
- [ ] `ThemeImageGallery.svelte` — galerie 3 photos max
- [ ] `LoanDialog.svelte` — prêt push vers une ludo
- [ ] `NetworkThemeCard.svelte` — carte dans le catalogue réseau

## Edge cases

- Un thème ne peut pas être prêté si un prêt actif existe déjà
- Max 3 photos : bouton upload désactivé si atteint
- Thème archivé : lisible mais non modifiable, non visible dans le réseau
- Upload : vérifier MIME côté serveur, pas seulement l'extension

## Critères d'acceptation

- [ ] Upload max 3 photos, formats jpg/png/webp, 5MB max
- [ ] Prêt impossible si prêt actif existe
- [ ] Historique des prêts visible sur la fiche
- [ ] Thèmes archivables

## Playwright tests

- [ ] Prêter un thème à une autre ludo (push)
- [ ] Voir le thème marqué "En prêt" chez la ludo destinataire
