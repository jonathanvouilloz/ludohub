# Feature : PLANNING — Saisons et samedis

**Epic :** 04 | **Taille :** L | **Statut :** TODO

## Description
Gestion du planning des samedis. Saisons avec dates, génération automatique des samedis, assignation des membres, swap entre membres, vue responsable (grille) et vue membre (mes prochains samedis).

## Tâches

### Pages
- [ ] `src/routes/[ludo]/planning/+page.svelte` — vue principale (switch membre/responsable)
- [ ] `src/routes/[ludo]/planning/+page.server.ts` — load saison active + slots
- [ ] `src/routes/[ludo]/planning/saisons/+page.svelte` — liste des saisons
- [ ] `src/routes/[ludo]/planning/saisons/[id]/+page.svelte` — détail saison (responsable)

### Services
- [ ] `src/lib/server/services/planning.ts`
  - `createSeason(ludoId, data)` → SeasonRow
  - `generateSaturdaySlots(seasonId, startDate, endDate)` → SlotRow[]
  - `assignMemberToSlot(slotId, memberId)` → AssignmentRow
  - `removeMemberFromSlot(slotId, memberId)` → void
  - `swapMembers(slotId, member1Id, member2Id)` → void
  - `cancelSlot(slotId)` → void
  - `getUpcomingSaturdaysForMember(memberId)` → { slot, assignments }[]
  - `getFullSeasonGrid(seasonId)` → { slot, assignments, absenceWarnings }[]

### DB queries
- [ ] `src/lib/server/db/planning.ts`
  - `getSeasonsByLudo(ludoId)` → SeasonRow[]
  - `getSlotsBySeason(seasonId)` → SlotRow[]
  - `getAssignmentsBySlot(slotId)` → AssignmentRow[]
  - `insertAssignment(data)` → AssignmentRow (UNIQUE check intégré)
  - `getUpcomingAssignmentsForMember(memberId)` → ...

### Utilitaires
- [ ] `src/lib/utils/dates.ts`
  - `getSaturdaysBetween(start: Date, end: Date)` → Date[]
  - `formatSwissDate(date: Date)` → string (DD.MM.YYYY)
  - `isSwissHoliday(date: Date)` → boolean (liste GE uniquement)

### Composants
- [ ] `PlanningGrid.svelte` — grille responsable (samedis × membres)
- [ ] `MySchedule.svelte` — vue membre (liste de mes samedis)
- [ ] `SlotCard.svelte` — carte d'un samedi
- [ ] `SwapDialog.svelte` — échange entre deux membres
- [ ] `AssignMemberDialog.svelte` — assignation depuis la grille

## Edge cases
- Samedi férié (GE) : slot marquable "annulé" par le responsable
- Membre absent ce jour : warning visuel orange si assigné malgré absence approuvée
- Double assignation : impossible (UNIQUE constraint en DB + check en service)
- Saison archivée : non-modifiable, visible en lecture seule

## Critères d'acceptation
- [ ] Génération automatique des samedis entre start_date et end_date
- [ ] Impossible d'assigner un même membre deux fois sur le même slot
- [ ] Swap : sélectionner deux membres → confirmation → échange atomique
- [ ] Vue membre : ses prochains samedis uniquement
- [ ] Vue responsable : grille complète avec warnings absences

## Playwright tests
- [ ] Créer une saison et assigner un membre à un samedi
- [ ] Tenter de double-assigner → erreur
- [ ] Swap entre deux membres → vérifier l'échange
