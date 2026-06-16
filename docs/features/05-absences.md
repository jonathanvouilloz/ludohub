# Feature : ABSENCES — Demande et approbation

**Epic :** 05 | **Taille :** M | **Statut :** DONE

## Etat session 2026-06-16 (clôture)

**Fait :** Epic 05 validé manuellement par Jonathan (demande/annulation membre, approbation/refus responsable, warning + recompte dans la grille, date picker, layout, radius select). 403 app-wide sur les form actions corrigé. `pnpm check` 0 erreur + `pnpm lint` OK.
**Prochain :** Epic 06-THÈMES (catalogue, items, photos Vercel Blob, prêts) — lire `docs/features/06-themes.md`.
**Pièges :** Form actions SvelteKit → toujours résoudre le contexte via `requireLudoContext`/`requireResponsableContext` (jamais lire `locals.ludo`/`currentMember`, posés seulement par le `load` du layout). CLI `shadcn-svelte add` inutilisable en non-interactif → créer les composants à la main sur bits-ui.
**Commit :** feat(absences): demande/approbation + warnings planning + fix 403 actions

## Carte du code
> Mise à jour : 2026-06-16

| Fichier | Rôle |
|---------|------|
| `src/lib/server/schema.ts` | Table `absences` + enums + `absencesRelations` (member) ; `members.absences` |
| `src/lib/server/db/absences.ts` | Queries Drizzle : CRUD + `getApprovedAbsencesInRange` (overlap) |
| `src/lib/server/services/absences.ts` | Logique métier : `requestAbsence`, `approve/refuse`, `cancelOwnAbsence`, `getApprovedAbsencesByMember` (Map) + `AbsenceServiceError` |
| `src/lib/server/services/planning.ts` | `getSeasonGrid` enrichit chaque assignation d'un champ `absence` |
| `src/lib/server/ludo-context.ts` | Helper `requireLudoContext`/`requireResponsableContext` pour les form actions (fix 403) |
| `src/routes/[ludo]/absences/+page.{server.ts,svelte}` | Page liste + actions request/cancel/approve/refuse |
| `src/lib/components/absences/NewAbsenceDialog.svelte` | Formulaire de demande (DatePicker Du/Au) |
| `src/lib/components/absences/AbsenceReviewDialog.svelte` | Approbation/refus responsable (note obligatoire au refus) |
| `src/lib/components/ui/date-picker/DatePicker.svelte` | Date picker réutilisable (bits-ui Popover+Calendar, valeur `YYYY-MM-DD`) |
| `src/lib/components/planning/SlotCard.svelte` | Badge « Absent » + recompte effectif |
| `src/lib/utils/dates.ts` | `isDateInRange(date, start, end)` |

### Décisions clés
- Le contexte ludo/membre des **actions** se résout via `ludo-context.ts` (les `load` du layout ne tournent pas avant une action en SvelteKit).
- Warning planning = badge visuel **+ recompte effectif** (l'assigné absent ne compte plus dans `filled`).
- Membre peut annuler sa propre demande tant qu'elle est `en_attente` ; note obligatoire pour un refus, optionnelle à l'approbation.

## Etat session 2026-06-16 (correctifs post-test)

`pnpm check` (0 erreur) + `pnpm lint` OK. En attente validation manuelle.

- **Bug 403 app-wide corrigé** : `locals.ludo`/`currentMember` ne sont posés que par le `load` du layout, jamais dispo dans une form action (les loads tournent après en SvelteKit). Nouveau helper `src/lib/server/ludo-context.ts` (`requireLudoContext` / `requireResponsableContext`) re-résout ludo+membre depuis `params.ludo` + session. Appliqué aux actions de `absences`, `settings/membres`, `planning/saisons`, `planning/saisons/[id]` ; layout DRY via le même helper.
- **Layout absences** : contenu wrappé dans `<main class="absences">` centré (max-width/padding) comme planning.
- **Select radius** : `rounded-lg` → `rounded-md` sur `select-trigger` + `select-content` (plus d'effet pilule).
- **Date picker** : composant réutilisable `src/lib/components/ui/date-picker/DatePicker.svelte` (Popover + Calendar bits-ui, locale fr-CH, valeur `YYYY-MM-DD` via input hidden). Remplace les `<input type=date>` dans `NewAbsenceDialog`. (CLI `shadcn-svelte add` bloquée en non-interactif → composant écrit à la main sur primitives bits-ui, sans générer ui/calendar+ui/popover.)

## Etat session 2026-06-16

Implémentation complète, `pnpm check` (0 erreur) + `pnpm lint` OK. En attente de validation manuelle, puis `/wrap-session` + commit.

Points d'implémentation (écarts vs plan initial du fichier) :

- **Relations Drizzle ajoutées** dans `schema.ts` : `absencesRelations` (member) + `members.absences`. Le stub `db/absences.ts` utilisait `with: { member: true }` sans relation → aurait planté au runtime. Corrigé.
- **Service** (`services/absences.ts`) : `AbsenceServiceError` + `requestAbsence`, `approveAbsence(id, ludoId, responderId, note?)`, `refuseAbsence(id, ludoId, responderId, note)` (note obligatoire), `cancelOwnAbsence(id, memberId)`, `listAbsencesForMember/ForLudo`, `getApprovedAbsencesByMember` (index Map pour le planning).
- **DB** (`db/absences.ts`) : `getAbsenceById`, `insertAbsence`, `updateAbsenceStatus`, `deleteAbsence`, `getApprovedAbsencesInRange` (overlap `start ≤ end AND end ≥ start`).
- **Intégration planning** : `getSeasonGrid()` (et non `getFullSeasonGrid`) enrichit chaque assignation d'un champ `absence`. `SlotCard.svelte` : badge "Absent" + **recompte effectif** (`filled = assignments sans absence`) → l'understaffed existant se déclenche.
- **Décisions produit** : membre peut annuler sa demande `en_attente` ; warning = badge + recompte effectif.
- Pas de composant Textarea shadcn → `<textarea>` natif stylé par tokens.
- Lien "Absences →" ajouté au dashboard `[ludo]/+page.svelte` (tous membres).

## Description

Système de demandes d'absence. Membre soumet, responsable approuve ou refuse avec note. Les absences approuvées génèrent des warnings dans le planning si le membre est assigné.

## Tâches

### Pages

- [x] `src/routes/[ludo]/absences/+page.svelte` — liste (membre = ses absences, responsable = toutes)
- [x] `src/routes/[ludo]/absences/+page.server.ts` — load + actions (request, cancel, approve, refuse)
- [x] `NewAbsenceDialog.svelte` — formulaire de demande
- [x] `AbsenceReviewDialog.svelte` — approbation/refus responsable

### Services

- [x] `src/lib/server/services/absences.ts` (noms réels)
  - `requestAbsence(data)` → AbsenceRow
  - `approveAbsence(id, ludoId, responderId, note?)` → AbsenceRow
  - `refuseAbsence(id, ludoId, responderId, note)` → AbsenceRow
  - `cancelOwnAbsence(id, memberId)` → void
  - `listAbsencesForMember(memberId)` / `listAbsencesForLudo(ludoId)`
  - `getApprovedAbsencesByMember(ludoId, start, end)` → Map<memberId, AbsenceRow[]>

### DB queries

- [x] `src/lib/server/db/absences.ts`
  - `insertAbsence(data)` → AbsenceRow
  - `getAbsenceById(id)` → AbsenceRow | undefined
  - `updateAbsenceStatus(id, { status, responderNotes, respondedBy })` → AbsenceRow
  - `deleteAbsence(id)` → void
  - `getAbsencesByMember(memberId)` / `getAbsencesByLudo(ludoId)` → AbsenceRow[]
  - `getApprovedAbsencesInRange(ludoId, startDate, endDate)` → AbsenceRow[]

### Intégration Planning

- [x] Dans `getSeasonGrid()` du service planning : croise avec `getApprovedAbsencesByMember()` → champ `absence` par assignation ; `SlotCard` affiche badge + recompte

## Critères d'acceptation

- [x] Types : congé / vacances / formation / indisponible
- [x] Statuts : en_attente → approuvé | refusé
- [x] Membre voit uniquement ses propres demandes + peut annuler une demande en attente
- [x] Responsable voit toutes les demandes de sa ludo
- [x] Warning visuel + recompte effectif dans la vue planning si conflit absence/assignation
- [x] Note de refus obligatoire (optionnelle pour approbation)

## Playwright tests

- [ ] Soumettre une absence → statut en_attente
- [ ] Responsable approuve → statut approuvé
- [ ] Warning visible dans la grille planning
