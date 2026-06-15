# Feature : MEMBRES — Gestion de l'équipe

**Epic :** 03 | **Taille :** S | **Statut :** DONE

## Etat session 2026-06-15

**Fait :**

- CRUD membres complet : page `[ludo]/settings/membres` (table shadcn + dialog create/edit + AlertDialog suppression).
- Couche `services/members.ts` (logique + garde-fous) au-dessus de `db/members.ts` (queries pures enrichies : soft/hard delete, `countResponsablesActifs`, `memberHasDependencies`).
- Garde-fous appliqués serveur + UI : pas d'auto-désactivation/suppression/rétrogradation, toujours ≥ 1 responsable actif ; suppression bloquée si assignations/absences (incl. `responded_by`, FK sans cascade).
- Zone `settings/` protégée par `+layout.server.ts` (guard `isResponsable` → 403) + nav latérale ; lien « Gérer l'équipe » sur le dashboard (responsables only).
- Fix outillage : `typescript-eslint` ajouté (ESLint était cassé), `eslint.config.js` ignore les composants shadcn vendored (`ui/`, `cn.ts`). `pnpm check` + `pnpm lint` verts. Test fonctionnel validé.

**Prochain :** Epic terminé. Démarrer **04-PLANNING** (saisons, samedis, assignations) — voir `docs/features/04-planning.md`. Les membres actifs (`getActiveMembersByLudo`) alimenteront les assignations.

**Pièges :** La FK `absences.responded_by` → `members.id` n'a PAS de cascade : `memberHasDependencies` la vérifie pour éviter une erreur Postgres brute. Le `name` du `Select.Root` shadcn fournit la valeur du rôle au form natif (pas de hidden input manuel).

**Commit :** feat(membres): CRUD membres + rôles avec garde-fous (settings)

---

## Carte du code

> Mise à jour : 2026-06-15

| Fichier                                              | Rôle                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/members.ts`                       | Queries Drizzle : list/get/create/update + soft/hard delete, count responsables, check dépendances |
| `src/lib/server/services/members.ts`                 | Logique métier + garde-fous (classe `MemberServiceError`, messages FR)                             |
| `src/routes/[ludo]/settings/+layout.server.ts`       | Guard `isResponsable` → 403 sur toute la zone settings                                             |
| `src/routes/[ludo]/settings/+layout.svelte`          | Nav latérale settings (item Membres actif via `page.url.pathname`)                                 |
| `src/routes/[ludo]/settings/membres/+page.server.ts` | Load (liste membres) + actions create/update/deactivate/reactivate/delete                          |
| `src/routes/[ludo]/settings/membres/+page.svelte`    | Table membres, boutons d'action, AlertDialog de suppression, banner d'erreur                       |
| `src/lib/components/membres/MemberDialog.svelte`     | Dialog create/edit (Input nom + Select rôle), `use:enhance`, ferme sur succès                      |
| `src/routes/[ludo]/+page.svelte`                     | Lien « Gérer l'équipe » (responsables only)                                                        |

### Decisions clés

- **db/ = queries pures, services/ = logique** (convention CLAUDE.md). Les garde-fous vivent dans le service, jamais dans les routes.
- **Garde-fous double couche** : vérité serveur (service lève `MemberServiceError`), UX préventive (boutons grisés côté page). Ne jamais se fier au seul front.
- **Suppression vs désactivation** : `isActive:false` est non destructif (exclut du login/planning) ; le hard delete n'est permis que sans dépendance — sinon message invitant à désactiver.

---

## Description

CRUD des membres par le responsable. Rôles : membre / responsable. Désactivation non-destructive. Suppression bloquée si des assignations ou absences existent.

## Tâches

### Pages

- [x] `src/routes/[ludo]/settings/membres/+page.svelte` — liste des membres
- [x] `src/routes/[ludo]/settings/membres/+page.server.ts` — load + actions (create, update, deactivate, delete)
- [x] Dialog d'ajout/édition membre
- [x] Confirmation avant désactivation/suppression

### Services

- [x] `src/lib/server/services/members.ts`
  - `createMember(ludoId, data)` → MemberRow
  - `updateMember(id, data)` → MemberRow
  - `deactivateMember(id)` → void
  - `deleteMember(id)` → void | throws si contraintes
  - `checkMemberHasAssignments(id)` → boolean _(implémenté en `memberHasDependencies` dans db/)_

### DB queries

- [x] `src/lib/server/db/members.ts`
  - `getMembersByLudo(ludoId)` → MemberRow[]
  - `getMemberById(id)` → MemberRow | null
  - `insertMember(data)` → MemberRow _(= `createMember`)_
  - `updateMemberById(id, data)` → MemberRow _(= `updateMember`)_
  - `softDeleteMember(id)` → void

### Composants

- [x] `MemberRow.svelte` — _non créé : la ligne reste inline dans `+page.svelte` (table lisible)_
- [x] `MemberDialog.svelte` — dialog create/edit

## Critères d'acceptation

- [x] Rôles : membre / responsable uniquement
- [x] `is_active: false` → non visible dans login + planning
- [x] Suppression bloquée avec message explicite si assignations existent
- [x] Accès réservé au responsable (guard dans layout ou action)
