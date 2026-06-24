# BACKLOG — Revue produit (revue du 2026-06-24)

Liste de suivi des points relevés par Jonathan. Chaque item a un statut :
`☐ à faire` · `◐ en cours` · `☑ fait` · `❓ à clarifier` (question ouverte ci-dessous).

Domaines : Navigation/Design · Accueil/Dashboard · Thèmes · Fréquentation · Planning · Newsletter/Emailing · Admin/Export · Technique.

> **Batch 1 livré (2026-06-24)** — 6 quick wins ✅ committés : Absences en bas, sidebar horizontale, prêt bloqué si thème installé, chevron mois, boutons +/− colorés, détail check-up dépliable.
>
> **Batch 2 codé (2026-06-24)** — 3 clusters ✅ (typecheck + 148 tests + ESLint OK) : bloc « objets à traiter » sur l'accueil, impression matériel d'un thème (`@media print`), types d'événement par ludo (table `event_types` + select « Autre » au dialog + CRUD réglages), newsletter (pagination serveur 50/page, désinscription liste, anonymisation RGPD, stats d'envoi par campagne + bounce→send, pilote TanStack Table sur les contacts). **À jouer : `pnpm db:push`** (table `event_types` + colonne `attendance_records.event_type_id`, additif). Reporté batch 3 : print planning, exports PDF, comparaison admin, refonte template mail.
>
> **+ UX modal (2026-06-24)** — modal de clôture fréquentation : compteurs en grille 2×2 à toutes les tailles, et primitive `dialog-content` bornée au viewport + corps scrollable (footer toujours atteignable, tous les modals).

---

## 1. Navigation & Design (sidebar)

- [x] **Sidebar desktop — « icône + label horizontal ».** ✅ _Batch 1 (2026-06-24)._ `--sidebar-width` 104→210px, `AppSidebar` en `layout="row"`, bouton « Quitter » aligné horizontal.
- [x] **Déplacer « Absences » en bas de la sidebar.** ✅ _Batch 1 (2026-06-24)._ Réordonné en fin de `nav-config.ts` (après Équipe).
- ~~Renommer « Absences »~~ — **abandonné** : le nom « Absences » est conservé. _(Décision 2026-06-24.)_

## 2. Accueil / Dashboard

- [x] **Bloc « objets à traiter » sur la page d'accueil.** ✅ _Batch 2 (2026-06-24)._ Bloc groupé par thème listant les objets `a_reparer`/`manquant` des installations en cours (`listProblematicItems`), liens vers la fiche thème. Rappel dashboard aligné sur la même source (`condition` du sous-ensemble installé).

## 3. Thèmes

- [x] **Impression de la liste du matériel d'un thème.** ✅ _Batch 2 (2026-06-24)._ Route `[ludo]/themes/[id]/print` (shell masqué via `bare` sur `/print`), checklist avec cases à cocher + quantités + état, `@media print`, bouton « Imprimer ».
- [x] **Empêcher le prêt d'un thème actif.** ✅ _Batch 1 (2026-06-24)._ Bouton « Prêter » masqué si `activeInstallation` + garde métier dans `loanTheme()`.
- [x] **Détail d'un check-up depuis l'historique.** ✅ _Batch 1 (2026-06-24)._ Lignes cliquables → expand inline (items présent/à réparer/manquant + noms + notes). Données déjà chargées (query enrichie `installationItem.themeItem`). Mobile reste en cartes résumé.

## 4. Fréquentation (events)

> Contexte : `attendance_records` avec contrainte `UNIQUE (ludo_id, date, period)`, période ∈ `matin / apres_midi / evenement`, `event_label` = texte libre obligatoire pour `evenement`. Donc **1 seul événement par jour** aujourd'hui.

- [x] **Plusieurs événements par jour.** ✅ _Batch 2 (2026-06-24)._ Déjà permis en DB (l'index `attendance_unique_slot` exclut `evenement`, `existsForSlot` ignore `evenement`) — aucun changement de contrainte nécessaire.
- [x] **Types d'événement prédéfinis, propres à chaque ludo.** ✅ _Batch 2 (2026-06-24)._ Table `event_types(ludoId, name, isArchived)` + `attendance_records.eventTypeId` (nullable, `set null`). `eventLabel` conservé : snapshot du nom à l'enregistrement (historique stable) ou saisie libre « Autre ». Select dans `CloseSessionDialog`, CRUD dans `settings/evenements`.
- [ ] **Choix de période simplifié + mode multi-step ?** Repenser le `CloseSessionDialog` (un `Stepper.svelte` existe déjà) : étapes claires, sélection période plus lisible.
- [x] **Boutons + / − des compteurs colorés.** ✅ _Batch 1 (2026-06-24)._ `Stepper.svelte` : − rouge (`--danger`) / + vert (`--success`), tokens uniquement.
- [x] **Chevron dans le header des mois.** ✅ _Batch 1 (2026-06-24)._ Chevron rotatif dans le `<summary>` (le repli `<details>` existait déjà).
- [ ] **Export rapport mensuel de fréquentation** — PDF propre avec statistiques (totaux adultes/enfants/prêts/retours, météo, etc.). C'était listé « V2 » dans le cadrage feature 14.
- [ ] **Export rapport de comparaison** (multi-mois / multi-période) — _voir aussi Admin §6._

## 5. Planning

- [ ] **Impression du planning** — version propre, clean, imprimable (CSS print dédié sur `[ludo]/planning`).

## 6. Newsletter / Emailing

- [x] **Tracking des envois.** ✅ _Batch 2 (2026-06-24)._ Page `newsletter/[id]/stats` (envoyés/échecs/rejets via `campaign_sends`), lien depuis la liste des campagnes envoyées. Webhook Resend étendu : `email_id` → `markCampaignSendBouncedByResendId` en plus du contact.
- [x] **Gestion de la désinscription côté liste.** ✅ _Batch 2 (2026-06-24)._ Action « désabonner / réabonner » par contact (`setContactSubscription`), statut visible.
- [x] **Anonymisation RGPD.** ✅ _Batch 2 (2026-06-24)._ `anonymizeContact` neutralise email/nom/notes + désabonne, garde la ligne pour préserver les stats `campaign_sends`. « Supprimer » reste pour le retrait total.
- [ ] **Revoir le design de base du mail** (template `email/template.ts`) — rendu plus soigné. _(Reporté batch 3.)_
- [x] **Pagination de la liste emails (50 / page).** ✅ _Batch 2 (2026-06-24)._ Pagination serveur (`listContacts` limit/offset + `countContacts`), tri serveur, contrôles préc./suiv.

## 7. Admin / Export

- [ ] **Export rapport de comparaison côté admin** — comparaison entre ludos / périodes (fréquentation, activité). PDF propre avec statistiques.

## 8. Technique

- [x] **Pilote TanStack Table sur la liste des contacts newsletter.** ✅ _Batch 2 (2026-06-24)._ `@tanstack/table-core` dans `ContactsTable.svelte` isolé (colonnes + état de tri ; pagination/tri pilotés serveur via `goto`, mode `manual*`). `DataTable` maison inchangé ailleurs. _Constat pilote :_ pour des tables 100 % server-driven, table-core apporte surtout le modèle de colonnes/tri ; bénéfice modéré.

---

## Décisions (revue 2026-06-24)

1. **Sidebar** → icône + label **horizontal** (sidebar élargie, item sur une ligne). ✅
2. **« Absences »** → on **garde le nom**, pas de renommage. ✅ (mais on la déplace en bas de la sidebar)
3. **Événements fréquentation** → **plusieurs par jour** + **types prédéfinis propres à chaque ludo** (la ludo crée ses libellés). ✅
4. **TanStack Table** → **pilote sur la liste newsletter uniquement**, pas de remplacement global du DataTable. ✅
