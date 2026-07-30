# BACKLOG — Revue produit (revues du 2026-06-24, 2026-07-22 et 2026-07-30)

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
>
> **Batch correctifs 2026-07-30** 🟡 — 3 items codés, **vérification en attente** (`node_modules` corrompu → `pnpm check`/`pnpm test` non exécutés) : modal de fréquentation qui se rouvre, indisponibilités invisibles + modal, saisie rétroactive. Détail, carte du code et pièges → [features/19-revue-produit-2026-07.md](features/19-revue-produit-2026-07.md).
>
> **Précisions 2026-07-30 (relecture en live)** — aucun item du 2026-07-22 n'était codé avant ce batch. Les 13 items sont **re-cadrés** ci-dessous (marqués `_(précisé 2026-07-30)_`) et les 3 questions ouvertes sont **tranchées** : swap **auto-proposé à valider** · domaine d'envoi **gelé au statu quo** · double ludo = **un espace, deux lieux** (cas d'usage moteur : la fréquentation). Deux items sortent du périmètre immédiat : Google Business Profile (§9) et domaine par ludo (§6).

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
- [x] **Saisie rétroactive d'une fréquentation.** 🟡 _Batch correctifs (2026-07-30), non vérifié._ Lien discret « Autre date » à côté de « Aujourd'hui · … » dans `CloseSessionDialog`, révélant un `DatePicker` borné à aujourd'hui (`maxValue`, prop ajoutée au composant). Le serveur n'a jamais restreint la date : la limite était purement UI. **L'édition d'une séance existante existait déjà** (action `?/update` + `openEdit`).
- [x] **🐛 La modal se rouvre après validation.** 🟡 _Batch correctifs (2026-07-30), non vérifié._ Cause : `?new=1` était relu dans un `$effect` réactif, donc ré-évalué à chaque reconstruction de `page.url` — dont celle déclenchée par l'`invalidateAll()` du submit. Nouvel utilitaire `src/lib/utils/new-intent.svelte.ts` qui consomme l'intention **une fois par URL** et protège `replaceState` (qui lève avant init du routeur). Le pattern était dupliqué dans `frequentation`, `games` et `supplies` → les trois passent par l'utilitaire.

## 5. Planning & Absences

- [ ] **Impression du planning** — version propre, clean, imprimable (CSS print dédié sur `[ludo]/planning`).
- [x] **🐛 Indisponibilités de début de saison — aucun retour visible.** 🟡 _Batch correctifs (2026-07-30), non vérifié._ Trou d'UI, pas un bug de calcul (reproduit en live : création saison → import GE → étape disponibilités). `SeasonMemberConfig.svelte` réécrit :
  - **(a) Feedback immédiat** — le panneau « + Indispo » reste ouvert après enregistrement et affiche **la liste des périodes du membre au-dessus du formulaire** ; la nouvelle ligne apparaît sur place. La colonne devient un **compteur** lisible (« 2 périodes · Voir ») au lieu de chips discrètes.
  - **(b) Modal « Voir les indisponibilités »** — dates, type, note et **suppression** (nouvelle action serveur `deleteUnavailability`).
  - **Cause probable du « ça ne marche pas totalement »** : la liste est filtrée sur la plage de la saison (`getApprovedAbsencesInRange`), donc une indispo saisie **hors saison** était enregistrée mais invisible. Les `DatePicker` sont désormais bornés à la saison (`minValue`/`maxValue`).
- [ ] **Absence en cours de saison → détection samedi + swap auto-proposé.** _(précisé 2026-07-30)_ Périmètre : **uniquement les samedis**, pas le planning normal. Depuis le bouton « ajouter une absence » pour un membre, le système doit indiquer si, **sur la période saisie**, ce membre était assigné à un ou plusieurs samedis. Si oui → **le système propose automatiquement un swap** (il choisit un remplaçant disponible) et **l'humain valide ou change**. Jamais appliqué sans validation. L'information circule **dans les deux sens** (l'absence remonte au planning, le planning remonte à l'absence). ✅ _Question 1 tranchée._

## 6. Newsletter / Emailing

- [x] **Tracking des envois.** ✅ _Batch 2 (2026-06-24)._ Page `newsletter/[id]/stats` (envoyés/échecs/rejets via `campaign_sends`), lien depuis la liste des campagnes envoyées. Webhook Resend étendu : `email_id` → `markCampaignSendBouncedByResendId` en plus du contact.
- [x] **Gestion de la désinscription côté liste.** ✅ _Batch 2 (2026-06-24)._ Action « désabonner / réabonner » par contact (`setContactSubscription`), statut visible.
- [x] **Anonymisation RGPD.** ✅ _Batch 2 (2026-06-24)._ `anonymizeContact` neutralise email/nom/notes + désabonne, garde la ligne pour préserver les stats `campaign_sends`. « Supprimer » reste pour le retrait total.
- [ ] **Revoir le design de base du mail** (template `email/template.ts`) — rendu plus soigné. _(Reporté batch 3.)_
- [x] **Pagination de la liste emails (50 / page).** ✅ _Batch 2 (2026-06-24)._ Pagination serveur (`listContacts` limit/offset + `countContacts`), tri serveur, contrôles préc./suiv.

> **Objectif : que le système de mail soit complet, utilisable de bout en bout et ÉVOLUTIF.** Le plan **Resend payant n'est pas un blocage** si une capacité en dépend — mais tout doit être fait proprement, de A à Z.

- [ ] **Pièces jointes.** _(revue 2026-07-22)_ D'abord vérifier si c'est déjà supporté aujourd'hui ; sinon l'ajouter (upload → Vercel Blob → `attachments` de l'API Resend, attention aux limites de taille).
- [ ] **Templates de mail.** _(revue 2026-07-22)_ Pouvoir créer et réutiliser des templates de campagne (par ludo).
- [ ] **Cycle de vie complet d'une campagne : archivage, pagination, suppression, duplication.** _(précisé 2026-07-30)_ Ce n'est plus seulement « documenter le comportement actuel » : le livrable est **du code**. Il faut que la pagination fonctionne, que l'archivage soit clair, qu'on puisse **supprimer** et **dupliquer** une campagne, et que l'ensemble soit **facilement évolutif**. Commencer par un état des lieux du comportement actuel, puis livrer les manques.
- [ ] **Tracking d'envoi plus complet.** _(précisé 2026-07-30)_ Au-delà des stats `campaign_sends` du batch 2 : le **nombre de personnes qui ont bien reçu**, statut `delivered` / `sent`. **Livrable préalable attendu : dire explicitement si un plan Resend payant est nécessaire** (webhooks `email.delivered`, `email.opened`… selon le plan) avant de coder quoi que ce soit.
- [ ] ❄️ **Domaine d'envoi par ludothèque — GELÉ, statu quo assumé.** _(précisé 2026-07-30)_ On **garde** un domaine unique (`NEWSLETTER_FROM`, celui du site) avec le **nom** d'expéditeur configurable par ludo. Pas d'étude ni de travail à engager pour l'instant. ✅ _Question 2 tranchée._

## 7. Admin / Export

- [ ] **Export rapport de comparaison côté admin** — comparaison entre ludos / périodes (fréquentation, activité). PDF propre avec statistiques.

## 8. Technique

- [x] **Pilote TanStack Table sur la liste des contacts newsletter.** ✅ _Batch 2 (2026-06-24)._ `@tanstack/table-core` dans `ContactsTable.svelte` isolé (colonnes + état de tri ; pagination/tri pilotés serveur via `goto`, mode `manual*`). `DataTable` maison inchangé ailleurs. _Constat pilote :_ pour des tables 100 % server-driven, table-core apporte surtout le modèle de colonnes/tri ; bénéfice modéré.

## 9. Réglages / Horaires

- [ ] **Horaires d'ouverture dans les réglages — version simple.** _(précisé 2026-07-30)_ Ajouter les horaires de la ludothèque dans `settings`. **On fait simple, sans Google My Business** (qui implique trop d'autres choses). Socle du module Pâquis (§12). À noter : sur une ludo double (§10), les horaires sont **par lieu**.
- [ ] ⏸️ **Connexion à la fiche Google Business Profile — reporté.** _(précisé 2026-07-30)_ Objectif **à terme** : qu'une ludothèque connecte sa fiche Google Business et modifie ses horaires directement depuis l'application (API Google Business Profile, OAuth par ludo). **Hors périmètre immédiat** — trop d'implications ; à rouvrir une fois les horaires simples en place et éprouvés.

## 10. Structure de données

- [ ] **Double ludothèque Pâquis-Sécheron — modèle « un espace, deux lieux ».** _(précisé 2026-07-30)_ Toutes les autres ludos sont des **lieux simples** ; Pâquis-Sécheron est une **double** ludothèque. Modèle retenu (confirmé 2026-07-30) : **deux lieux physiques distincts, mais UNE SEULE ÉQUIPE qui gère les deux** → un seul slug / espace / login, **un seul jeu de membres**, avec N lieux (table `sites` ou `locations` rattachée à la ludo, `1` lieu par défaut pour les 11 autres). Les membres, le planning et l'équipe ne sont **pas** dédoublés ; ce qui se rattache à un lieu, c'est ce qui est **physique** (fréquentation, horaires, adresse). ✅ _Question 3 tranchée._
  - **Cas d'usage moteur : la fréquentation.** C'est là que la différence est concrète — à la saisie, il faut dire **dans quel lieu** on relève. Les stats et le dashboard doivent pouvoir être lus par lieu **et** consolidés.
  - **Phase 2 (confort, pas prérequis) : pré-sélection du lieu par géolocalisation.** Stocker l'**adresse (lat/lng) par lieu**, demander l'autorisation navigateur, pré-cocher le lieu le plus proche. ⚠️ La géoloc **ne peut pas être la source de vérité** : précise sur mobile (GPS, 5–20 m) mais pas sur desktop (wifi/IP, 100 m à plusieurs km) alors que Pâquis et Sécheron sont proches, et l'autorisation peut être refusée. Donc : **sélecteur explicite toujours présent et modifiable**, géoloc en simple suggestion. Fallback moins cher qui couvre l'essentiel : **mémoriser le dernier lieu choisi sur l'appareil**.
  - Balayer ensuite les autres modules : planning/samedis, thèmes et installations, réseau, newsletter, admin.

## 11. Auth

- [ ] **Durcir l'authentification, sans l'alourdir.** _(revue 2026-07-22)_ Aujourd'hui : mot de passe partagé par ludo + sélection de membre — très simple. Ajouter **une couche de sécurité en plus, mais légère** : ce n'est pas une app grand public, le public cible reste du staff peu technique. Pistes à arbitrer (rate limiting sur le login, expiration/rotation de session, PIN par membre pour les actions sensibles, 2FA optionnel pour les responsables).

## 12. Module site public (Pâquis-Sécheron uniquement)

- [ ] **Alimenter le site de Pâquis-Sécheron depuis LudoHub.** _(revue 2026-07-22)_ Le site de Pâquis sera **directement relié** à l'app pour : **horaires**, **membres de l'équipe**, **événements**, **blog**, **carnets d'activités**. Il faut donc un **module dédié, activable uniquement pour cette ludothèque** (flag par ludo + exposition publique en lecture, probablement des routes API/JSON consommées par le site). Dépend de §9 (horaires) et §10 (double ludothèque). Projet lié : `ludo-paquis` (`projets/ludo/website`).

---

## Questions tranchées (2026-07-30)

1. **Absence → samedi (§5).** → **Swap auto-proposé, validé par l'humain.** Le système détecte les samedis assignés sur la période et propose un remplaçant ; la personne valide ou change. Jamais appliqué automatiquement.
2. **Domaine d'envoi par ludo (§6).** → **Statu quo, item gelé.** Domaine unique, nom d'expéditeur configurable. Pas d'étude engagée pour l'instant.
3. **Double ludothèque (§10).** → **Un espace, deux lieux.** Un seul slug/login, N lieux rattachés. Le cas d'usage qui pilote le modèle est la **fréquentation** (saisie par lieu).

## Questions ouvertes

_(aucune — les trois questions de la revue 2026-07-22 sont tranchées ci-dessus)_

---

## Décisions (revue 2026-07-30)

1. **Swap sur absence** → **auto-proposé, validé par l'humain**, samedis uniquement.
2. **Saisie rétroactive de fréquentation** → option **discrète** sur la page fréquentation (cas rare).
3. **Domaine d'envoi Resend** → **statu quo** (domaine unique, nom d'expéditeur variable). Item gelé.
4. **Horaires** → version **simple** dans les settings ; **Google Business Profile reporté**.
5. **Double ludothèque** → **un espace, deux lieux** ; géoloc en pré-sélection seulement, jamais source de vérité.
6. **Mail** → le cycle de vie (archivage / pagination / suppression / duplication) devient du **code**, pas une note.

## Décisions (revue 2026-06-24)

1. **Sidebar** → icône + label **horizontal** (sidebar élargie, item sur une ligne). ✅
2. **« Absences »** → on **garde le nom**, pas de renommage. ✅ (mais on la déplace en bas de la sidebar)
3. **Événements fréquentation** → **plusieurs par jour** + **types prédéfinis propres à chaque ludo** (la ludo crée ses libellés). ✅
4. **TanStack Table** → **pilote sur la liste newsletter uniquement**, pas de remplacement global du DataTable. ✅
