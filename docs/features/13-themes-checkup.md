# Feature : THÈMES — Installations & check-ups

**Epic :** 13 | **Taille :** M-L | **Statut :** SPEC (à faire)

## Etat session 2026-06-17

**Fait :**

- Cadrage initial (cette spec). Aucune ligne de code.
- Constat : la fonctionnalité de check-up existait sur **samediLudoV2** mais **n'a jamais été reportée** dans LudoHub — absente du PRD comme du code.
- Clarification métier de Jonathan intégrée (distinction contenu complet / sous-ensemble installé).

**Prochain :** Valider la spec, puis phase 1 = schema (4 tables) + `db:push`, puis services, puis pages.
**Pièges :** Ne pas confondre `theme_items` (liste de référence complète, dans la caisse) et les items réellement **installés** (sous-ensemble sorti). Le check-up ne porte QUE sur le sous-ensemble installé.
**Commit :** [23b5e97] docs(themes): cadre epic 13 (installations & check-ups thèmes)

---

## Carte du code

> À compléter lors de l'implémentation. Fichiers cibles prévus ci-dessous.

| Fichier (prévu)                                              | Role                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `src/lib/server/schema.ts`                                  | + tables `theme_installations`, `theme_installation_items`, `theme_checkups`, `theme_checkup_items` + enums + relations + types |
| `src/lib/server/db/installations.ts`                        | Queries installations + check-ups                              |
| `src/lib/server/services/installations.ts`                  | Logique : installer (sélection sous-ensemble), clôturer, enregistrer un check-up |
| `src/routes/[ludo]/themes/[id]/+page.server.ts`             | + actions installer/clôturer (réutilise la fiche thème existante) |
| `src/routes/[ludo]/themes/[id]/installations/+page.*`       | Historique des installations d'un thème (option)               |
| `src/routes/[ludo]/themes/[id]/installations/[iid]/+page.*` | Détail installation : sous-ensemble + check-ups + bouton « nouveau check-up » |
| `src/lib/components/themes/InstallDialog.svelte`            | Sélection du sous-ensemble d'items à sortir                    |
| `src/lib/components/themes/CheckupForm.svelte`              | Checklist présent/manquant (quantité dans le label)            |
| `src/lib/components/themes/CheckupHistory.svelte`           | Historique des check-ups d'une installation                    |

### Décisions clés (à respecter)

- **`theme_items` = liste de référence complète** (contenu total du thème, ce qui dort dans la grosse boîte plastique). On NE la modifie PAS lors d'une installation.
- **Installation = sous-ensemble sorti** pour l'animation (souvent 70-80% du contenu). Historisée et datée (qui, quand). Une seule installation `en_cours` par thème à la fois.
- **Check-up = contrôle quotidien** rattaché à une installation. Porte uniquement sur les items installés (ce qui bouge). Ce qui reste en caisse ne bouge pas → pas de check-up dessus.
- **Granularité check-up = présent / manquant par item** (binaire). La quantité de l'item s'affiche dans le **label** (ex. « Cartes (×52) »), pas en input chiffré.
- **Tous les membres actifs** peuvent installer / clôturer / faire un check-up (cohérent avec epic 06 : actions via `requireLudoContext`, pas responsable).
- **Installation par le propriétaire OU l'emprunteur d'un prêt actif** (voir Décisions tranchées). `ludo_id` = ludo où le thème est physiquement installé.
- Réutiliser le dispatcher `emitEvent` (epic 10) pour journaliser install/clôture/check-up dans `activity_log`. **Check-up avec ≥1 item manquant → notif** aux membres de la ludo.

## Description

Aujourd'hui un thème = une boîte avec une liste plate d'items (`theme_items`). Mais
dans la réalité d'une ludo :

1. Le thème complet vit dans une grosse caisse plastique avec **toute** sa liste de contenu.
2. Quand on **installe** le thème dans la ludo pour une animation, on ne sort pas tout : on choisit ~70-80 % du contenu jugé pertinent. Le reste reste dans la caisse.
3. On fait des **check-ups quotidiens** sur ce qui a été installé (ce qui circule et peut se perdre). Ce qui dort dans la caisse n'a pas besoin de contrôle.

Cette feature ajoute donc deux notions au-dessus du modèle thèmes existant :
**installation** (événement daté = quel sous-ensemble est sorti) et **check-up**
(contrôle daté présent/manquant des items installés).

## Modèle de données (proposé)

```
theme_installations       (id, theme_id, ludo_id, installed_by_member_id,
                           installed_at, closed_at, status, notes, created_at)
  -- status: installation_status enum ['en_cours', 'cloturee']
  -- ludo_id : ludo où le thème est installé (= owner en MVP ; peut différer via prêt)
  -- une seule 'en_cours' par theme_id à un instant donné

theme_installation_items  (id, installation_id, theme_item_id)
  -- le sous-ensemble d'items sortis pour cette installation
  -- FK theme_item_id → theme_items.id (la liste de référence)

theme_checkups            (id, installation_id, checked_by_member_id,
                           checked_at, notes, created_at)
  -- un contrôle daté (typiquement quotidien) sur une installation en cours

theme_checkup_items       (id, checkup_id, installation_item_id, status, note)
  -- status: checkup_item_status enum ['present', 'manquant']
  -- un état par item installé pour ce check-up
```

**Relations clés :**

- `theme_installations.theme_id` → `themes.id` (cascade)
- `theme_installations.ludo_id` → `ludotheques.id`
- `theme_installations.installed_by_member_id` → `members.id`
- `theme_installation_items.installation_id` → `theme_installations.id` (cascade)
- `theme_installation_items.theme_item_id` → `theme_items.id`
- `theme_checkups.installation_id` → `theme_installations.id` (cascade)
- `theme_checkup_items.checkup_id` → `theme_checkups.id` (cascade)
- `theme_checkup_items.installation_item_id` → `theme_installation_items.id`

## Flows

**Flow — Installer un thème :**

1. Fiche thème → bouton « Installer dans la ludo » (désactivé si une installation `en_cours` existe déjà)
2. Dialog : cocher parmi les items du thème ceux qu'on sort (sous-ensemble), note optionnelle
3. Confirmer → crée `theme_installations` (`en_cours`) + `theme_installation_items`
4. Le thème affiche « Installé depuis le [date] — N/M items sortis »

**Flow — Check-up quotidien :**

1. Sur l'installation en cours → « Nouveau check-up »
2. Liste des items installés, chacun avec son label `Nom (×quantité)` et un toggle **présent / manquant**
3. Note optionnelle → Enregistrer → crée `theme_checkups` + `theme_checkup_items`
4. Historique des check-ups visible (date, auteur, nb manquants)

**Flow — Clôturer une installation :**

1. Quand on remet le thème dans la caisse → « Clôturer l'installation »
2. `status = cloturee`, `closed_at = now`. L'historique (installation + check-ups) reste consultable.

## Tâches

### Phase 1 — Schema

- [ ] 4 tables + 3 enums (`installation_status`, `checkup_item_status`) dans `schema.ts`
- [ ] Relations Drizzle + types (`ThemeInstallationRow`, `ThemeCheckupRow`, …)
- [ ] `pnpm db:push` vers Neon

### Phase 2 — DB + Services

- [ ] `db/installations.ts` : créer installation + items, lister, détail (with check-ups), check-up actif
- [ ] `services/installations.ts` :
  - `installTheme(themeId, ludoId, memberId, itemIds[], note?)` → refuse si installation `en_cours` existe ; refuse si `itemIds` vide / hors thème
  - `closeInstallation(installationId, ludoId)`
  - `recordCheckup(installationId, memberId, statuses[], note?)` → refuse si installation clôturée
  - `getInstallationDetail`, `listInstallations(themeId)`
- [ ] Journalisation via `emitEvent` (install / clôture / check-up)

### Phase 3 — Pages & composants

- [ ] Actions installer/clôturer sur `[ludo]/themes/[id]/+page.server.ts` + bloc « Installation en cours » sur la fiche
- [ ] Route détail installation (sous-ensemble + check-ups + nouveau check-up)
- [ ] `InstallDialog.svelte`, `CheckupForm.svelte`, `CheckupHistory.svelte`

### Phase 4 — Tests

- [ ] `services/installations.test.ts` (1 seule installation en cours, sous-ensemble vide refusé, check-up sur installation clôturée refusé)
- [ ] e2e : installer → check-up avec un item manquant → historique

## Edge cases

- Une seule installation `en_cours` par thème (le bouton « Installer » est désactivé sinon).
- Sous-ensemble vide interdit (au moins 1 item sorti).
- Items `is_archived` du thème : exclus de la sélection d'installation.
- Item manquant lors d'un check-up : surface visible sur l'installation + notif aux membres de la ludo (`emitEvent`).
- Installation autorisée pour la ludo propriétaire ou l'emprunteuse d'un prêt actif ; refus sinon.
- Thème archivé : ne peut pas être installé.
- Clôturer une installation fige son historique ; les check-ups passés restent lisibles.

## Critères d'acceptation

- [ ] On peut installer un sous-ensemble d'items et le voir daté/historisé.
- [ ] Une seule installation active par thème.
- [ ] Un check-up enregistre présent/manquant par item installé, avec quantité affichée dans le label.
- [ ] Historique des installations et des check-ups consultable.
- [ ] Ce qui reste en caisse (items non installés) n'apparaît pas dans les check-ups.

## Décisions tranchées (2026-06-17)

- **Item manquant → notification.** Quand un check-up marque ≥1 item `manquant`, émettre un événement via `emitEvent` (alimente `activity_log` + notif aux membres de la ludo). Pas de notif si tout est présent.
- **Qui peut installer :** la ludo **propriétaire** OU la ludo **emprunteuse d'un prêt actif** (`theme_loans.status = 'actif'`). Dans ce 2ᵉ cas, `theme_installations.ludo_id` = la ludo emprunteuse. Le contexte d'install se résout via `requireLudoContext` ; on autorise si `ludoId === theme.ownerLudoId` ou s'il existe un prêt actif `to_ludo_id === ludoId`.
- **Pas de contrôle de fréquence.** Aucun rappel « pas de check-up depuis X jours ». Les check-ups sont créés à la demande, sans cadence imposée.
