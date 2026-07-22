# BACKLOG — Revue produit (revues du 2026-06-24 et 2026-07-22)

Liste de suivi des points relevés par Jonathan. Chaque item a un statut :
`☐ à faire` · `◐ en cours` · `☑ fait` · `❓ à clarifier` (question ouverte ci-dessous).

Domaines : Navigation/Design · Accueil/Dashboard · Thèmes · Fréquentation · Planning & Absences · Newsletter/Emailing · Admin/Export · Technique · Réglages/Horaires · Structure de données · Auth · Module site public (Pâquis-Sécheron).

> **Batch 1 livré (2026-06-24)** — 6 quick wins ✅ committés : Absences en bas, sidebar horizontale, prêt bloqué si thème installé, chevron mois, boutons +/− colorés, détail check-up dépliable.
>
> **Batch 2 codé (2026-06-24)** — 3 clusters ✅ (typecheck + 148 tests + ESLint OK) : bloc « objets à traiter » sur l'accueil, impression matériel d'un thème (`@media print`), types d'événement par ludo (table `event_types` + select « Autre » au dialog + CRUD réglages), newsletter (pagination serveur 50/page, désinscription liste, anonymisation RGPD, stats d'envoi par campagne + bounce→send, pilote TanStack Table sur les contacts). **À jouer : `pnpm db:push`** (table `event_types` + colonne `attendance_records.event_type_id`, additif). Reporté batch 3 : print planning, exports PDF, comparaison admin, refonte template mail.
>
> **+ UX modal (2026-06-24)** — modal de clôture fréquentation : compteurs en grille 2×2 à toutes les tailles, et primitive `dialog-content` bornée au viewport + corps scrollable (footer toujours atteignable, tous les modals).
>
> **Revue 2026-07-22 (note vocale)** — 13 nouveaux items, marqués `_(revue 2026-07-22)_` ci-dessous : absences/vacances + swap samedi (§5), fréquentation rétroactive + bug de modal (§4), chantier mail complet — pièces jointes, templates, tracking, domaine d'envoi par ludo (§6), horaires + Google Business Profile (§9), double ludothèque Pâquis-Sécheron (§10), durcissement auth (§11), module site public Pâquis (§12). Brut : `cerveau/10-Projets/ludo/hub/transcripts/2026-07-22_revue-produit-vocal.md`.

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
- [ ] **Saisie rétroactive d'une fréquentation.** _(revue 2026-07-22)_ Aujourd'hui on ne peut saisir que pour le **jour même**. Pouvoir **ajouter** une fréquentation à une date passée (oubli) et **éditer** une fréquentation existante. Une option directement sur la page fréquentation suffit — pas besoin d'un écran dédié.
- [ ] **🐛 La modal se rouvre après validation.** _(revue 2026-07-22)_ Ajout + validation d'une fréquentation : l'enregistrement passe bien, mais la fenêtre se **rouvre automatiquement** juste après (`CloseSessionDialog` — état d'ouverture non réinitialisé après l'action ?).

## 5. Planning & Absences

- [ ] **Impression du planning** — version propre, clean, imprimable (CSS print dédié sur `[ludo]/planning`).
- [ ] **Vacances en début de saison — comportement incomplet.** _(revue 2026-07-22)_ Ajouter des vacances à un membre **en début de saison** ne fonctionne pas totalement. À reproduire puis reprendre (epic 05-absences).
- [ ] **Absence en cours de saison → détection samedi + swap.** _(revue 2026-07-22)_ Périmètre : **uniquement les samedis**, pas le planning normal. Depuis un bouton « ajouter une absence » pour un membre, le système doit indiquer si, **sur la période saisie**, ce membre était assigné à un ou plusieurs samedis — et si oui, enchaîner sur le changement (swap). L'information doit circuler **dans les deux sens** (l'absence remonte au planning, le planning remonte à l'absence). ❓ _Voir question 1 ci-dessous._

## 6. Newsletter / Emailing

- [x] **Tracking des envois.** ✅ _Batch 2 (2026-06-24)._ Page `newsletter/[id]/stats` (envoyés/échecs/rejets via `campaign_sends`), lien depuis la liste des campagnes envoyées. Webhook Resend étendu : `email_id` → `markCampaignSendBouncedByResendId` en plus du contact.
- [x] **Gestion de la désinscription côté liste.** ✅ _Batch 2 (2026-06-24)._ Action « désabonner / réabonner » par contact (`setContactSubscription`), statut visible.
- [x] **Anonymisation RGPD.** ✅ _Batch 2 (2026-06-24)._ `anonymizeContact` neutralise email/nom/notes + désabonne, garde la ligne pour préserver les stats `campaign_sends`. « Supprimer » reste pour le retrait total.
- [ ] **Revoir le design de base du mail** (template `email/template.ts`) — rendu plus soigné. _(Reporté batch 3.)_
- [x] **Pagination de la liste emails (50 / page).** ✅ _Batch 2 (2026-06-24)._ Pagination serveur (`listContacts` limit/offset + `countContacts`), tri serveur, contrôles préc./suiv.

> **Objectif de la revue 2026-07-22 : que le système de mail soit complet et utilisable de bout en bout.** Le plan **Resend payant n'est pas un blocage** si une capacité en dépend — mais tout doit être fait proprement.

- [ ] **Pièces jointes.** _(revue 2026-07-22)_ D'abord vérifier si c'est déjà supporté aujourd'hui ; sinon l'ajouter (upload → Vercel Blob → `attachments` de l'API Resend, attention aux limites de taille).
- [ ] **Templates de mail.** _(revue 2026-07-22)_ Pouvoir créer et réutiliser des templates de campagne (par ludo).
- [ ] **Clarifier archivage / pagination / duplication.** _(revue 2026-07-22)_ Comprendre et documenter le comportement actuel sur ces trois points, puis décider ce qui doit changer. Livrable attendu : une note de comportement, pas forcément du code.
- [ ] **Tracking d'envoi plus complet.** _(revue 2026-07-22)_ Au-delà des stats `campaign_sends` du batch 2 : le **nombre de personnes qui ont bien reçu**, statut `delivered` / `sent` si l'API le permet. Évaluer jusqu'où Resend permet de pousser (webhooks `email.delivered`, `email.opened`… selon le plan).
- [ ] **Domaine d'envoi par ludothèque.** _(revue 2026-07-22)_ Aujourd'hui : un seul domaine d'envoi (celui du site, `NEWSLETTER_FROM`) ; seul le **nom** de l'expéditeur est configurable, l'adresse reste la même. Étudier ce qu'implique un domaine (ou sous-domaine) **spécifique par ludo** côté Resend. ❓ _Voir question 2 ci-dessous — l'attente première est de comprendre les options ; le statu quo reste acceptable._

## 7. Admin / Export

- [ ] **Export rapport de comparaison côté admin** — comparaison entre ludos / périodes (fréquentation, activité). PDF propre avec statistiques.

## 8. Technique

- [x] **Pilote TanStack Table sur la liste des contacts newsletter.** ✅ _Batch 2 (2026-06-24)._ `@tanstack/table-core` dans `ContactsTable.svelte` isolé (colonnes + état de tri ; pagination/tri pilotés serveur via `goto`, mode `manual*`). `DataTable` maison inchangé ailleurs. _Constat pilote :_ pour des tables 100 % server-driven, table-core apporte surtout le modèle de colonnes/tri ; bénéfice modéré.

## 9. Réglages / Horaires

- [ ] **Horaires d'ouverture dans les réglages.** _(revue 2026-07-22)_ Ajouter les horaires de la ludothèque dans `settings`. C'est aussi le socle du module Pâquis (§12) et de la connexion Google (item suivant).
- [ ] **Connexion à la fiche Google Business Profile.** _(revue 2026-07-22)_ Objectif **à terme** : qu'une ludothèque connecte sa fiche Google Business et modifie ses horaires **directement depuis l'application** (API Google Business Profile, OAuth par ludo). À cadrer une fois les horaires en place.

## 10. Structure de données

- [ ] **Double ludothèque Pâquis-Sécheron.** _(revue 2026-07-22)_ Toutes les autres ludos sont des **lieux simples** ; Pâquis-Sécheron est une **double** ludothèque. Revoir le modèle pour que ce cas soit correctement géré **dans tous les modules** (planning/samedis, fréquentation, thèmes et installations, réseau, newsletter, admin). ❓ _Voir question 3 ci-dessous._

## 11. Auth

- [ ] **Durcir l'authentification, sans l'alourdir.** _(revue 2026-07-22)_ Aujourd'hui : mot de passe partagé par ludo + sélection de membre — très simple. Ajouter **une couche de sécurité en plus, mais légère** : ce n'est pas une app grand public, le public cible reste du staff peu technique. Pistes à arbitrer (rate limiting sur le login, expiration/rotation de session, PIN par membre pour les actions sensibles, 2FA optionnel pour les responsables).

## 12. Module site public (Pâquis-Sécheron uniquement)

- [ ] **Alimenter le site de Pâquis-Sécheron depuis LudoHub.** _(revue 2026-07-22)_ Le site de Pâquis sera **directement relié** à l'app pour : **horaires**, **membres de l'équipe**, **événements**, **blog**, **carnets d'activités**. Il faut donc un **module dédié, activable uniquement pour cette ludothèque** (flag par ludo + exposition publique en lecture, probablement des routes API/JSON consommées par le site). Dépend de §9 (horaires) et §10 (double ludothèque). Projet lié : `ludo-paquis` (`projets/ludo/website`).

---

## Questions ouvertes (revue 2026-07-22)

1. **Absence → samedi (§5).** « Faire le changement » = **swap automatique proposé** par le système (il choisit un remplaçant disponible et le soumet), ou **simple alerte** à l'humain qui choisit lui-même dans le mécanisme de swap existant ?
2. **Domaine d'envoi par ludo (§6).** Un domaine (ou sous-domaine) par ludothèque implique une **vérification DNS par ludo** côté Resend — donc de l'admin récurrent à chaque nouvelle ludo. À arbitrer après l'étude : garder un domaine unique avec nom d'expéditeur variable, ou passer à des sous-domaines gérés.
3. **Double ludothèque (§10).** « Double » = **deux lieux sous un même slug/espace** (un seul login, deux sites physiques), ou **deux slugs frères** reliés ? Le choix change tout le modèle en aval.

---

## Décisions (revue 2026-06-24)

1. **Sidebar** → icône + label **horizontal** (sidebar élargie, item sur une ligne). ✅
2. **« Absences »** → on **garde le nom**, pas de renommage. ✅ (mais on la déplace en bas de la sidebar)
3. **Événements fréquentation** → **plusieurs par jour** + **types prédéfinis propres à chaque ludo** (la ludo crée ses libellés). ✅
4. **TanStack Table** → **pilote sur la liste newsletter uniquement**, pas de remplacement global du DataTable. ✅
