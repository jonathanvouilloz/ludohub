# BACKLOG — Revue produit (revue du 2026-06-24)

Liste de suivi des points relevés par Jonathan. Chaque item a un statut :
`☐ à faire` · `◐ en cours` · `☑ fait` · `❓ à clarifier` (question ouverte ci-dessous).

Domaines : Navigation/Design · Accueil/Dashboard · Thèmes · Fréquentation · Planning · Newsletter/Emailing · Admin/Export · Technique.

> **Batch 1 livré (2026-06-24)** — 6 quick wins ✅ committés : Absences en bas, sidebar horizontale, prêt bloqué si thème installé, chevron mois, boutons +/− colorés, détail check-up dépliable. Reste tous les autres items ci-dessous (batch 2+).

---

## 1. Navigation & Design (sidebar)

- [x] **Sidebar desktop — « icône + label horizontal ».** ✅ _Batch 1 (2026-06-24)._ `--sidebar-width` 104→210px, `AppSidebar` en `layout="row"`, bouton « Quitter » aligné horizontal.
- [x] **Déplacer « Absences » en bas de la sidebar.** ✅ _Batch 1 (2026-06-24)._ Réordonné en fin de `nav-config.ts` (après Équipe).
- ~~Renommer « Absences »~~ — **abandonné** : le nom « Absences » est conservé. _(Décision 2026-06-24.)_

## 2. Accueil / Dashboard

- [ ] **Bloc « notifications du thème » sur la page d'accueil.** Surfacer sur `[ludo]/+page.svelte` les items de thèmes nécessitant une action : à réparer / à racheter (issus des check-ups → item manquant/cassé). Relier au dispatcher de notifs existant (`action_required`).

## 3. Thèmes

- [ ] **Impression de la liste du matériel d'un thème** — format checklist propre et imprimable, à glisser dans la caisse physique du thème. (Vue print dédiée, CSS `@media print`, items + quantités, en-tête thème/ludo.)
- [x] **Empêcher le prêt d'un thème actif.** ✅ _Batch 1 (2026-06-24)._ Bouton « Prêter » masqué si `activeInstallation` + garde métier dans `loanTheme()`.
- [x] **Détail d'un check-up depuis l'historique.** ✅ _Batch 1 (2026-06-24)._ Lignes cliquables → expand inline (items présent/à réparer/manquant + noms + notes). Données déjà chargées (query enrichie `installationItem.themeItem`). Mobile reste en cartes résumé.

## 4. Fréquentation (events)

> Contexte : `attendance_records` avec contrainte `UNIQUE (ludo_id, date, period)`, période ∈ `matin / apres_midi / evenement`, `event_label` = texte libre obligatoire pour `evenement`. Donc **1 seul événement par jour** aujourd'hui.

- [ ] **Plusieurs événements par jour.** Lever la contrainte `UNIQUE (ludo_id, date, period)` pour les `evenement` (garder l'unicité pour `matin`/`apres_midi`, ou ajouter un discriminant). _(Décision 2026-06-24.)_
- [ ] **Types d'événement prédéfinis, propres à chaque ludo.** Remplacer le `event_label` texte libre par une sélection parmi des types **définis par la ludo** (chaque ludo gère ses propres types : « soirée jeu », « anniversaire », etc.). Implique : nouvelle table de types d'événement scopée `ludoId` + CRUD léger + select dans `CloseSessionDialog` (avec option « autre » / saisie libre ?). _(Décision 2026-06-24.)_
- [ ] **Choix de période simplifié + mode multi-step ?** Repenser le `CloseSessionDialog` (un `Stepper.svelte` existe déjà) : étapes claires, sélection période plus lisible.
- [x] **Boutons + / − des compteurs colorés.** ✅ _Batch 1 (2026-06-24)._ `Stepper.svelte` : − rouge (`--danger`) / + vert (`--success`), tokens uniquement.
- [x] **Chevron dans le header des mois.** ✅ _Batch 1 (2026-06-24)._ Chevron rotatif dans le `<summary>` (le repli `<details>` existait déjà).
- [ ] **Export rapport mensuel de fréquentation** — PDF propre avec statistiques (totaux adultes/enfants/prêts/retours, météo, etc.). C'était listé « V2 » dans le cadrage feature 14.
- [ ] **Export rapport de comparaison** (multi-mois / multi-période) — _voir aussi Admin §6._

## 5. Planning

- [ ] **Impression du planning** — version propre, clean, imprimable (CSS print dédié sur `[ludo]/planning`).

## 6. Newsletter / Emailing

- [ ] **Tracking des envois** : suivi de ce qui a été envoyé, bounces, blocks, désinscriptions — vue/statuts par campagne. (Webhook Resend bounces déjà en place ; étendre à blocks/plaintes + UI de suivi.)
- [ ] **Gestion de la désinscription** côté liste de contacts (visibilité claire des `unsubscribed`, ré-inscription ?).
- [ ] **Anonymisation / suppression des données (RGPD)** : pouvoir anonymiser ou supprimer un contact et son historique d'envois (droit à l'oubli).
- [ ] **Revoir le design de base du mail** (template `email/template.ts`) — rendu plus soigné.
- [ ] **Pagination de la liste emails (50 / page ?).** → lié à l'item technique TanStack §7.

## 7. Admin / Export

- [ ] **Export rapport de comparaison côté admin** — comparaison entre ludos / périodes (fréquentation, activité). PDF propre avec statistiques.

## 8. Technique

- [ ] **Tester TanStack Table — pilote sur la liste des contacts newsletter** (tri + pagination 50/page). Périmètre volontairement limité à ce seul tableau pour évaluer avant toute généralisation ; le `DataTable` maison reste en place ailleurs. _(Décision 2026-06-24.)_

---

## Décisions (revue 2026-06-24)

1. **Sidebar** → icône + label **horizontal** (sidebar élargie, item sur une ligne). ✅
2. **« Absences »** → on **garde le nom**, pas de renommage. ✅ (mais on la déplace en bas de la sidebar)
3. **Événements fréquentation** → **plusieurs par jour** + **types prédéfinis propres à chaque ludo** (la ludo crée ses libellés). ✅
4. **TanStack Table** → **pilote sur la liste newsletter uniquement**, pas de remplacement global du DataTable. ✅
