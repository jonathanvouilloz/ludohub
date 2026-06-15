# Feature : ABSENCES — Demande et approbation

**Epic :** 05 | **Taille :** M | **Statut :** TODO

## Description
Système de demandes d'absence. Membre soumet, responsable approuve ou refuse avec note. Les absences approuvées génèrent des warnings dans le planning si le membre est assigné.

## Tâches

### Pages
- [ ] `src/routes/[ludo]/absences/+page.svelte` — liste (membre = ses absences, responsable = toutes)
- [ ] `src/routes/[ludo]/absences/+page.server.ts` — load + actions (create, approve, refuse)
- [ ] `NewAbsenceDialog.svelte` — formulaire de demande
- [ ] `AbsenceReviewDialog.svelte` — approbation/refus responsable

### Services
- [ ] `src/lib/server/services/absences.ts`
  - `createAbsenceRequest(data)` → AbsenceRow
  - `approveAbsence(id, responderId, note?)` → AbsenceRow
  - `refuseAbsence(id, responderId, note)` → AbsenceRow
  - `getAbsencesForMember(memberId)` → AbsenceRow[]
  - `getPendingAbsencesForLudo(ludoId)` → AbsenceRow[]
  - `getApprovedAbsencesOverlappingSlot(ludoId, date)` → AbsenceRow[]

### DB queries
- [ ] `src/lib/server/db/absences.ts`
  - `insertAbsence(data)` → AbsenceRow
  - `updateAbsenceStatus(id, status, note, responderId)` → AbsenceRow
  - `getAbsencesByMember(memberId)` → AbsenceRow[]
  - `getAbsencesByLudo(ludoId, status?)` → AbsenceRow[]
  - `getApprovedAbsencesInRange(ludoId, startDate, endDate)` → AbsenceRow[]

### Intégration Planning
- [ ] Dans `getFullSeasonGrid()` du service planning : croiser avec `getApprovedAbsencesInRange()` pour générer les warnings

## Critères d'acceptation
- [ ] Types : congé / vacances / formation / indisponible
- [ ] Statuts : en_attente → approuvé | refusé
- [ ] Membre voit uniquement ses propres demandes
- [ ] Responsable voit toutes les demandes de sa ludo
- [ ] Warning visuel dans la vue planning si conflit absence/assignation
- [ ] Note de refus obligatoire (optionnelle pour approbation)

## Playwright tests
- [ ] Soumettre une absence → statut en_attente
- [ ] Responsable approuve → statut approuvé
- [ ] Warning visible dans la grille planning
