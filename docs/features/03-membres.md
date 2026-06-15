# Feature : MEMBRES — Gestion de l'équipe

**Epic :** 03 | **Taille :** S | **Statut :** TODO

## Description
CRUD des membres par le responsable. Rôles : membre / responsable. Désactivation non-destructive. Suppression bloquée si des assignations ou absences existent.

## Tâches

### Pages
- [ ] `src/routes/[ludo]/settings/membres/+page.svelte` — liste des membres
- [ ] `src/routes/[ludo]/settings/membres/+page.server.ts` — load + actions (create, update, deactivate, delete)
- [ ] Dialog d'ajout/édition membre
- [ ] Confirmation avant désactivation/suppression

### Services
- [ ] `src/lib/server/services/members.ts`
  - `createMember(ludoId, data)` → MemberRow
  - `updateMember(id, data)` → MemberRow
  - `deactivateMember(id)` → void
  - `deleteMember(id)` → void | throws si contraintes
  - `checkMemberHasAssignments(id)` → boolean

### DB queries
- [ ] `src/lib/server/db/members.ts`
  - `getMembersByLudo(ludoId)` → MemberRow[]
  - `getMemberById(id)` → MemberRow | null
  - `insertMember(data)` → MemberRow
  - `updateMemberById(id, data)` → MemberRow
  - `softDeleteMember(id)` → void

### Composants
- [ ] `MemberRow.svelte` — ligne dans le tableau
- [ ] `MemberDialog.svelte` — dialog create/edit

## Critères d'acceptation
- [ ] Rôles : membre / responsable uniquement
- [ ] `is_active: false` → non visible dans login + planning
- [ ] Suppression bloquée avec message explicite si assignations existent
- [ ] Accès réservé au responsable (guard dans layout ou action)
