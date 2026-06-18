# Feature : ABSENCES — Demande et approbation

**Epic :** 05 | **Taille :** M | **Statut :** DONE (itératif)

## Etat session 2026-06-18 (responsable planifie/supprime + DatePicker min)

**Fait :**

- **Responsable planifie une absence pour un membre** : nouvelle fn service `createAbsenceForMember` (status `approuve` direct, `respondedBy` = responsable, notifie le membre via `absence_approved`), action `?/createForMember`. `NewAbsenceDialog` bi-mode : si responsable → titre « Planifier une absence » + sélecteur de membre + type défaut `vacances`, sinon workflow demande classique inchangé. Le load fournit `members` (actifs) aux responsables.
- **Suppression d'absence par responsable** : fn `deleteAbsenceForLudo` (garde tenant via `requireAbsenceInLudo`), action `?/deleteAbsence`, bouton corbeille + `AlertDialog` de confirmation sur **toutes** les lignes (tous statuts). Membre garde son annulation `cancel` (en_attente uniquement).
- **DatePicker — `minValue` + mois aligné** (transverse) : prop `minValue?: string` sur `DatePicker` → bits-ui désactive les jours antérieurs, `bind:placeholder` ouvre le calendrier sur le mois de la borne min quand aucune valeur n'est posée, efface la valeur si elle passe sous la borne. Branché sur les 4 couples (absences, fermetures, saison, indispo membre) : le picker de fin reçoit `minValue={dateDébut}`.
- `pnpm check` 0 erreur / 0 warning.

**Prochain :** Epic 05 complet (itératif). Prochain epic non démarré : **12-TESTS E2E** (Playwright).

**Pièges :**

- DatePicker : ne pas initialiser `calPlaceholder` en référençant un prop réactif (`minValue`/`value`) dans `$state(...)` → warning Svelte `state_referenced_locally`. Init à `undefined`, l'effet `if (minDv && !dv)` règle le mois au montage.
- `createAbsenceForMember` réutilise le type de notif `absence_approved` (titre/corps custom) → aucune migration d'enum.

**Commit :** (à renseigner)

## Carte du code
> Mise à jour : 2026-06-18

| Fichier | Rôle |
|---------|------|
| `src/lib/server/schema.ts` | Table `absences` + enums + `absencesRelations` (member) ; `members.absences` |
| `src/lib/server/db/absences.ts` | Queries Drizzle : CRUD + `getApprovedAbsencesInRange` (overlap) |
| `src/lib/server/services/absences.ts` | `requestAbsence`, `approve/refuse`, `cancelOwnAbsence`, **`createAbsenceForMember`** (responsable, approuvé direct + notif), **`deleteAbsenceForLudo`** (responsable, garde tenant), `getApprovedAbsencesByMember` (Map) |
| `src/routes/[ludo]/absences/+page.server.ts` | Load (membres aux responsables) + actions request/cancel/approve/refuse + **createForMember** + **deleteAbsence** |
| `src/routes/[ludo]/absences/+page.svelte` | Liste ; bouton « Planifier une absence » (responsable) + **corbeille + AlertDialog** par ligne |
| `src/lib/components/absences/NewAbsenceDialog.svelte` | **Bi-mode** : sélecteur membre + action conditionnelle ; picker fin `minValue={startDate}` |
| `src/lib/components/absences/AbsenceReviewDialog.svelte` | Approbation/refus responsable (note obligatoire au refus) |
| `src/lib/components/ui/date-picker/DatePicker.svelte` | **Prop `minValue`** (jours antérieurs désactivés) + `bind:placeholder` (mois aligné) + clear si valeur < min |
| `src/lib/components/planning/{ClosurePeriodsPanel,SeasonDialog,SeasonMemberConfig}.svelte` | Picker de fin branché `minValue={dateDébut}` |
| `src/lib/server/ludo-context.ts` | Helper `requireLudoContext`/`requireResponsableContext` pour les form actions |

### Décisions clés

- **Responsable crée une absence approuvée directe** (`createAbsenceForMember`) — bypass du workflow demande→validation ; notifie le membre concerné.
- **Suppression responsable = tous statuts** ; le membre reste limité à l'annulation de sa demande `en_attente`.
- **DatePicker `minValue`** : la borne min vient de la date de début ; le composant gère désactivation + mois d'ouverture + cohérence (efface fin < début).

## Etat session 2026-06-16 (clôture)

**Fait :** Epic 05 validé manuellement par Jonathan (demande/annulation membre, approbation/refus responsable, warning + recompte dans la grille, date picker, layout, radius select). 403 app-wide sur les form actions corrigé. `pnpm check` 0 erreur + `pnpm lint` OK.
**Prochain :** Epic 06-THÈMES (catalogue, items, photos Vercel Blob, prêts) — lire `docs/features/06-themes.md`.
**Pièges :** Form actions SvelteKit → toujours résoudre le contexte via `requireLudoContext`/`requireResponsableContext` (jamais lire `locals.ludo`/`currentMember`, posés seulement par le `load` du layout). CLI `shadcn-svelte add` inutilisable en non-interactif → créer les composants à la main sur bits-ui.
**Commit :** feat(absences): demande/approbation + warnings planning + fix 403 actions

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
