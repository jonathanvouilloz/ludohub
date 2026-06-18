# Feature : PLANNING — Saisons et samedis

**Epic :** 04 | **Taille :** L | **Statut :** DONE (itératif)

## Etat session 2026-06-18 (auto-génération planning + wizard + saison active + import ge.ch)

**Fait :**

- **Auto-génération du planning** : nouvelle table `season_member_settings` (isPermanent par saison), service `generatePlanning` (phase 1 permanents → phase 2 pool équitable, contrainte pas 2 samedis consécutifs, auto-annulation fériés GE), action `?/generatePlanning` avec `requiredCount` configurable (défaut 3).
- **Wizard 3 étapes** sur la page de détail saison (avant génération) : Étape 1 Vacances & fermetures → Étape 2 Config membres (DataTable + DatePicker shadcn) → Étape 3 Stats + effectif + Générer. Après génération : PlanningGrid seul, plus de wizard.
- **Saison active explicite** : colonne `is_active` sur `seasons`, `activateSeason` (archive atomiquement l'ancienne via `db.batch()`), 3 états (Active/En préparation/Archivée), badge ⚡ Activer, case « Activer immédiatement » dans SeasonDialog, `SeasonDialog` migré vers DatePicker shadcn.
- **Import vacances ge.ch** : scraping HTML `ge.ch/vacances-scolaires-YYYY-YYYY` (attribut `title=` sur `<a href="*/telecharger">`), parsing 3 patterns de dates françaises, gestion multi-années scolaires, bouton « ↓ Importer ge.ch » dans ClosurePeriodsPanel (8 périodes importées sur 2026-2027).
- **Polish UI** : steps wizard fond bleu primaire + texte blanc, cards fermetures fond `--bg-card` (blanc) au lieu du jaune.

**Prochain :** Epic 04 complet. Prochain epic : **12-TESTS E2E** (Playwright). Penser à activer une saison manuellement depuis `/planning/saisons` (toutes les saisons existantes ont `isActive=false` après migration).

**Pièges :**

- `db.batch()` requis pour les mutations multi-tables atomiques (neon-http sans transaction interactive) — voir `activateSeasonInDb` et `swapAssignments`.
- Import ge.ch : utiliser l'attribut `title="..."` du `<a>`, PAS le contenu textuel (contient un `<span>` imbriqué qui casse `[^<]+`). Tester avec un `.mjs` standalone, pas un heredoc bash (les backslashes se perdent).
- Regex `new RegExp(pattern)` avec `\\s`/`\\d` : valide en TypeScript compilé, mais les heredocs bash dropent un niveau de backslash → tester via fichier.
- `geAcademicYears(startDate, endDate)` → peut retourner 2 URLs si la saison couvre deux années scolaires.

**Commit :** [9752312] feat(planning): auto-génération planning, wizard, saison active, import ge.ch

---

## Carte du code

> Mise à jour : 2026-06-18

| Fichier | Rôle |
|---------|------|
| `src/lib/server/schema.ts` | Tables `season_member_settings` (isPermanent) + colonne `seasons.isActive` + `seasons.requiredCount` default 3 |
| `src/lib/server/db/planning.ts` | `upsertMemberSetting`, `getMemberSettingsBySeason`, `clearAssignmentsBySeason`, `updateSlotsRequiredCount`, `activateSeasonInDb`, `archiveSeason` (+ deactivate) |
| `src/lib/server/services/planning.ts` | `generatePlanning` (algo 2 phases), `saveMemberConfig`, `addMemberUnavailability`, `importGEVacations`, `activateSeason`, `createSeason` (activateNow) |
| `src/lib/utils/ge-vacances.ts` | **Nouveau** — `parseGEVacancesHTML` (title attr + `<a href="*/telecharger">`), `geAcademicYear`, `geAcademicYears` |
| `src/routes/[ludo]/planning/saisons/+page.server.ts` | Action `activate` + `create` lit `activateNow` |
| `src/routes/[ludo]/planning/saisons/+page.svelte` | Badge 3 états (Active/En préparation/Archivée) + bouton ⚡ Activer |
| `src/routes/[ludo]/planning/saisons/[id]/+page.server.ts` | Actions `saveMemberConfig`, `addUnavailability`, `generatePlanning` (lit `requiredCount`), `importFromGE` |
| `src/routes/[ludo]/planning/saisons/[id]/+page.svelte` | Bascule wizard ↔ grille selon `existingAssignmentsCount` |
| `src/lib/components/planning/SeasonWizard.svelte` | **Nouveau** — wizard 3 étapes, step pills fond primaire bleu |
| `src/lib/components/planning/SeasonMemberConfig.svelte` | DataTable + DatePicker shadcn + toggle permanent + ajout indispo inline |
| `src/lib/components/planning/ClosurePeriodsPanel.svelte` | DatePicker shadcn + bouton import ge.ch + fond blanc cards |
| `src/lib/components/planning/SeasonDialog.svelte` | DatePicker shadcn + case « Activer immédiatement » |

### Décisions clés

- **Permanent = par saison** (table `season_member_settings`), pas global sur le membre.
- **Indisponibilités wizard → absences approuvées** (status `approuve` direct), réutilise le système existant + warnings planning.
- **Saison active explicite** (`is_active` boolean) ; `activateSeason` archive atomiquement l'ancienne (`db.batch()`).
- **Import ge.ch** : cibler `title=` sur `<a href="*/telecharger">` (le contenu texte contient un `<span class="material-icons">` qui casse `[^<]+`).
- **Wizard disparaît** dès qu'il existe des assignations (`existingAssignmentsCount > 0`) — génération est une action unique, pas régénérable.

---

## Etat session 2026-06-17 (refonte vue membre + vacances + swap membre)

**Fait :**

- **Vue membre `/planning` refondue** en timeline (`PlanningTimeline.svelte`, remplace l'ancienne grille `readOnly` + `MySchedule` supprimé) : groupage par mois, **samedis passés repliés** (toggle « N samedis passés »), carte hero « Mon prochain samedi » (+ « dans N jours » + co-assignés), badge **PROCHAIN** + highlight, bg cream sur vacances/fériés, mise en avant de mes assignations, filtre « Tous les membres ».
- **Swap initié par un membre** : icône ⇄ sur mon samedi → `MemberSwapDialog` (« Échanger un samedi »). Service `requestSwap` (autorisé si demandeur = partie A). Action `swap` sur `/planning` via `requireLudoContext`. Assigner/retirer/annuler restent responsable-only (ajoutés inline sur la timeline + action sur `/planning`).
- **Plages de fermeture/vacances** : nouvelle table `closure_periods` (label + dates par saison), CRUD responsable dans `saisons/[id]` (`ClosurePeriodsPanel`). `getSeasonGrid` annote chaque slot d'une `closure` couvrante → bg cream, hors effectif. `SlotCard` rendu conscient des fermetures.
- **Bug « espace vide / bouton invisible » résolu** : la classe `collapse` entrait en collision avec l'utilitaire Tailwind `collapse` (`visibility: collapse`) → élément invisible mais occupant la place. Renommée `past-toggle`.
- `pnpm check` 0 erreur/warning ; ESLint clean ; Prettier ciblé.

**Prochain :** Epic 04 complet. Reste l'epic **12-TESTS E2E** (Playwright) : ajouter flow « membre échange son samedi » + « plage de fermeture masque l'effectif » + « samedis passés repliés/dépliés ».
**Pieges :**

- **Ne jamais nommer une classe de composant comme un utilitaire Tailwind** (`collapse`, `hidden`, `flex`, `grid`…) : le scoped style n'override que ce qu'il déclare, le reste vient de Tailwind. Cf. mémoire `tailwind-class-name-collision`.
- `pnpm db:push` requis (table `closure_periods`) — fait par Jonathan, validé en runtime.

**Commit :** [7d099c2] feat(planning): timeline membre, swap membre, plages de fermeture

---

## Etat session 2026-06-16 (suite — fix 403)

**Fait :**

- **Bug 403 résolu.** Cause : les `load` planning lisaient `locals.ludo`/`locals.currentMember` de façon synchrone alors qu'ils ne sont posés qu'après 2 `await` dans `[ludo]/+layout.server.ts` → course concurrente entre `load` SvelteKit → `locals` vide → `throw error(403)`.
- Fix : les 3 `load` planning (`+page`, `saisons/+page`, `saisons/[id]/+page`) utilisent désormais `await parent()` (le layout **retourne** `{ ludo, currentMember }`), ce qui crée une dépendance explicite et garantit les valeurs.
- Warning Better Auth `Base URL is not set` corrigé : ajout `baseURL` dans `src/lib/server/auth.ts`.
- Validé en runtime par Jonathan (Bruno Martin, membre simple → accès `/planning` OK ; warning disparu).
- `pnpm check` 0 erreur, eslint clean sur les fichiers touchés.

**Prochain :** Epic 04 fonctionnel. Reste optionnel : tests Playwright (création saison + assignation, double-assignation, swap). Sinon enchaîner **epic 05-ABSENCES**.

**Pieges :**

- Ne **jamais** lire `locals.ludo`/`locals.currentMember` dans un `load` enfant → toujours `await parent()` (les `load` SvelteKit s'exécutent en parallèle, `locals` posé par le layout n'est pas garanti).
- Les **actions** (`requireContext(locals)`) restent inchangées et fonctionnent (validé runtime responsable) — même convention que membres (epic 03).
- Lint repo rouge sur 2 docs (`docs/PLAN.md`, `docs/features/04-planning.md`) : dette de formatage pré-existante, hors scope.

**Commit :** [à venir] fix(planning): resolve 403 on member access via await parent() + set Better Auth baseURL

---

## Etat session 2026-06-16

**Fait :**

- Schema : ajout `relations()` Drizzle (seasons/slots/assignments/members) — **sans ça les requêtes `with` plantaient au runtime** —, colonne `seasons.isArchived`, types `SaturdaySlotInsert`/`AssignmentInsert`.
- Couche données complète (`db/planning.ts`) + service durci (`services/planning.ts` : `PlanningServiceError`, gardes tenant, swap croisé atomique via `db.batch()`, blocage saison archivée).
- `isGenevaHoliday()` ajouté à `utils/dates.ts`. Routes `[ludo]/planning/` (page + saisons liste + saisons détail) + 6 composants planning.
- Consultation ouverte à **tous les membres connectés** ; mutations réservées aux responsables (actions `requireContext`).
- `pnpm check` 0 erreur, `pnpm lint` vert.

**Prochain :** **BUG 403 non résolu.** Bruno Martin (membre) a toujours 403 sur `/planning`. Cause probable : `locals.ludo`/`locals.currentMember` posés par `[ludo]/+layout.server.ts` _après_ des `await`, lus en parallèle par le `load` de page → `undefined` → `throw error(403)`. Fix : remplacer la lecture de `locals` par `await parent()` dans les 3 `+page.server.ts` du planning (vérifier aussi pourquoi membres marche : peut-être à migrer pareil). Puis régler le warning Better Auth `Base URL is not set` via `BETTER_AUTH_URL`.

**Pieges :**

- `db:push` requis (colonne `isArchived`) — à confirmer fait par Jonathan.
- Driver `neon-http` = pas de transaction interactive → swap via `db.batch()`.
- `isCancelled` vs `type:'annule'` redondants dans le schema → source de vérité = `isCancelled` (`type` non câblé).

**Commit :** [à venir] feat(planning): saisons, samedis, assignations, swap (WIP, 403 à corriger)

---

## Description

Gestion du planning des samedis. Saisons avec dates, génération automatique des samedis, assignation des membres, swap entre membres, vue responsable (grille) et vue membre (mes prochains samedis).

## Tâches

### Pages

- [x] `src/routes/[ludo]/planning/+page.svelte` — vue principale (grille + mes samedis, ouverte à tous)
- [x] `src/routes/[ludo]/planning/+page.server.ts` — load saison active + slots
- [x] `src/routes/[ludo]/planning/saisons/+page.svelte` — liste des saisons
- [x] `src/routes/[ludo]/planning/saisons/[id]/+page.svelte` — détail saison (édition responsable)

### Services

- [x] `src/lib/server/services/planning.ts` (noms réels : `createSeason`, `assignMember`, `removeMember`, `swapMembers`, `cancelSlot`/`reopenSlot`, `getMyUpcomingSaturdays`, `getSeasonGrid`)
  - `createSeason(ludoId, data)` → SeasonRow
  - `generateSaturdaySlots(seasonId, startDate, endDate)` → SlotRow[]
  - `assignMemberToSlot(slotId, memberId)` → AssignmentRow
  - `removeMemberFromSlot(slotId, memberId)` → void
  - `swapMembers(slotId, member1Id, member2Id)` → void
  - `cancelSlot(slotId)` → void
  - `getUpcomingSaturdaysForMember(memberId)` → { slot, assignments }[]
  - `getFullSeasonGrid(seasonId)` → { slot, assignments, absenceWarnings }[]

### DB queries

- [x] `src/lib/server/db/planning.ts`
  - `getSeasonsByLudo(ludoId)` → SeasonRow[]
  - `getSlotsBySeason(seasonId)` → SlotRow[]
  - `getAssignmentsBySlot(slotId)` → AssignmentRow[]
  - `insertAssignment(data)` → AssignmentRow (UNIQUE check intégré)
  - `getUpcomingAssignmentsForMember(memberId)` → ...

### Utilitaires

- [x] `src/lib/utils/dates.ts` (existants réutilisés : `getSwissSaturdays`, `formatDateShort`, `toDateString` ; ajouté : `isGenevaHoliday`)

### Composants

- [x] `PlanningGrid.svelte` — grille (samedis × membres) + dialogs assign/swap
- [x] `MySchedule.svelte` — vue membre (liste de mes samedis)
- [x] `SlotCard.svelte` — carte d'un samedi
- [x] `SwapDialog.svelte` — échange croisé entre deux samedis
- [x] `AssignMemberDialog.svelte` — assignation depuis la grille
- [x] `SeasonDialog.svelte` — création de saison

## Edge cases

- Samedi férié (GE) : slot marquable "annulé" par le responsable
- Membre absent ce jour : warning visuel orange si assigné malgré absence approuvée
- Double assignation : impossible (UNIQUE constraint en DB + check en service)
- Saison archivée : non-modifiable, visible en lecture seule

## Critères d'acceptation

- [x] Génération automatique des samedis entre start*date et end_date (code) — *à valider en runtime\_
- [x] Impossible d'assigner un même membre deux fois sur le même slot (UNIQUE + check service)
- [x] Swap : sélectionner deux membres → confirmation → échange atomique (`db.batch`)
- [x] Vue membre : ses prochains samedis (section « Mes prochains samedis »)
- [~] Vue responsable : grille complète — **warnings absences reportés à l'epic 05**

## Décisions de cadrage (session 2026-06-16)

- Warnings d'absences : **reportés à l'epic 05** (table `absences` non interrogée ici).
- Saisons : CRUD + **archivage** (colonne `isArchived`, lecture seule si archivée).
- Swap : **échange croisé** entre deux samedis distincts.
- Planning : **consultation ouverte à tous les membres connectés**, mutations responsable-only.

## Playwright tests

- [ ] Créer une saison et assigner un membre à un samedi
- [ ] Tenter de double-assigner → erreur
- [ ] Swap entre deux membres → vérifier l'échange

## Carte du code

> Mise à jour : 2026-06-17

| Fichier                                                   | Rôle                                                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/lib/server/schema.ts`                                | Tables planning + `relations()` + `seasons.isArchived` + **table `closure_periods`** + relations    |
| `src/lib/server/db/planning.ts`                           | Queries saisons/slots/assignations, `swapAssignments` (db.batch), CRUD `closure_periods`            |
| `src/lib/server/services/planning.ts`                     | Métier : gardes tenant, swap responsable + **`requestSwap`** (membre), annotation `closure`, CRUD plages |
| `src/lib/utils/dates.ts`                                  | `getSwissSaturdays`, `isGenevaHoliday`, `formatDayMonth`, `formatMonthYear`, `daysBetween`          |
| `src/routes/[ludo]/planning/+page.server.ts`              | Load timeline (slots+membres+today) + actions swap (membre) / assign-remove-cancel (responsable)    |
| `src/routes/[ludo]/planning/saisons/[id]/+page.server.ts` | Grille saison + actions assign/remove/cancel/swap + **createClosure/deleteClosure** (responsable)   |
| `src/lib/components/planning/PlanningTimeline.svelte`     | **Vue membre** : timeline mois, passés repliés, hero, badge PROCHAIN, filtre, swap, édition inline  |
| `src/lib/components/planning/MemberSwapDialog.svelte`     | Dialog « Échanger un samedi » initié par un membre                                                  |
| `src/lib/components/planning/ClosurePeriodsPanel.svelte`  | CRUD plages de fermeture/vacances (éditeur de saison)                                                |
| `src/lib/components/planning/{PlanningGrid,SlotCard,SeasonDialog,AssignMemberDialog,SwapDialog}.svelte` | Grille responsable de l'éditeur de saison (SlotCard conscient des fermetures)        |

### Decisions cles

- **`relations()` Drizzle obligatoires** pour l'API `with` — absentes initialement, plantaient au runtime.
- **`neon-http` sans transaction interactive** → swap atomique via `db.batch()`.
- **Ne jamais lire `locals.ludo`/`locals.currentMember` dans un `load` enfant** → `await parent()` (cause du bug 403, résolu).
- **Vacances/fermetures = données saisies par le responsable** (table `closure_periods`), pas un calendrier scolaire codé en dur : annotées au rendu, les slots ne sont pas supprimés.
- **Swap membre** : un membre n'échange que SON samedi (`requestSwap` vérifie demandeur = partie A) ; assigner/retirer reste responsable-only.
- **Piège classe CSS** : ne pas nommer une classe comme un utilitaire Tailwind (`collapse` → `visibility: collapse`). Cf. mémoire `tailwind-class-name-collision`.
