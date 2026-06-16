# Feature : PLANNING — Saisons et samedis

**Epic :** 04 | **Taille :** L | **Statut :** DONE

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

> Mise à jour : 2026-06-16 (suite)

| Fichier                                                   | Rôle                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/server/schema.ts`                                | Tables planning + `relations()` + `seasons.isArchived`                           |
| `src/lib/server/db/planning.ts`                           | Queries saisons/slots/assignations, `swapAssignments` (db.batch)                 |
| `src/lib/server/services/planning.ts`                     | Logique métier : gardes tenant, validation, blocage archivé, swap                |
| `src/lib/utils/dates.ts`                                  | `getSwissSaturdays`, `isGenevaHoliday`, `toDateString`, `formatDate*`            |
| `src/routes/[ludo]/planning/+page.server.ts`              | Load grille saison active + mes samedis (ouvert à tous)                          |
| `src/routes/[ludo]/planning/saisons/+page.server.ts`      | Liste saisons + actions create/archive/delete (responsable)                      |
| `src/routes/[ludo]/planning/saisons/[id]/+page.server.ts` | Grille saison + actions assign/remove/cancel/swap (responsable)                  |
| `src/lib/components/planning/*.svelte`                    | PlanningGrid, SlotCard, SeasonDialog, AssignMemberDialog, SwapDialog, MySchedule |

### Decisions cles

- **`relations()` Drizzle obligatoires** pour l'API `with` — absentes initialement, plantaient au runtime.
- **`neon-http` sans transaction interactive** → swap atomique via `db.batch()`.
- **Ne jamais lire `locals.ludo`/`locals.currentMember` dans un `load` enfant** → `await parent()` (les `load` SvelteKit tournent en parallèle ; `locals` posé par le layout n'est pas garanti). C'était la cause du bug 403, résolu.
