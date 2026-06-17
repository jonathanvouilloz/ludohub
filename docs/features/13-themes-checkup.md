# Feature : THÈMES — Installations & check-ups

**Epic :** 13 | **Taille :** M-L | **Statut :** DONE

## Etat session 2026-06-17 (b)

**Fait :**

- Implémentation complète des 4 phases (schema → DB/services → pages/composants → tests).
- Schema : 2 enums + 4 tables (`theme_installations`, `theme_installation_items`, `theme_checkups`, `theme_checkup_items`) + relations + types + 4 nouveaux `notificationType`. `db:push` joué par Jonathan.
- Services : `installTheme` / `closeInstallationForLudo` / `recordCheckup` (notif responsables si item manquant via `emitEvent`, autorisation owner OU prêt actif). `db/installations.ts` + `getActiveLoanToLudo`.
- UI : bouton « Installer » + bloc « Installé depuis… » sur la fiche thème, route détail `installations/[iid]`, composants `InstallDialog` / `CheckupForm` / `CheckupHistory`. Tweak : input number quantité retiré du form d'ajout d'item (quantité visuelle, schema conservé).
- Tests : `installations.test.ts` 15/15 ; suite complète 100/100 ; `pnpm check` + lint + prettier verts.

**Prochain :** Epic terminé. Flows e2e (installer → check-up manquant → historique) reportés à l'epic 12-TESTS. Optionnel : exposer l'install côté ludo emprunteuse (le service l'autorise déjà, mais la fiche thème est owner-only).
**Pièges :** Les notifications ne stockent pas de `metadata` (table sans colonne) → les 4 nouveaux types de notif pointent vers `/[slug]/themes` (liste), pas vers l'installation précise. Le `themeId` est dans `activity_log.metadata` uniquement.
**Commit :** [1cfcaf2] feat(themes): installations & check-ups (epic 13)

---

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

> Mise à jour : 2026-06-17

| Fichier                                                          | Role                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/lib/server/schema.ts`                                      | 2 enums (`installation_status`, `checkup_item_status`) + 4 tables + relations + types + 4 nouveaux `notificationType` |
| `src/lib/server/db/installations.ts`                            | Queries : `getActiveInstallation`, `getInstallationDetail`, `createInstallation`, `closeInstallation`, `createCheckup`, `listInstallations` |
| `src/lib/server/db/loans.ts`                                    | + `getActiveLoanToLudo(themeId, toLudoId)` (autorisation install côté emprunteur)          |
| `src/lib/server/services/installations.ts`                      | `installTheme`, `closeInstallationForLudo`, `recordCheckup` + lectures ; garde-fous + `emitEvent` |
| `src/lib/server/services/events.ts`                             | + mappings `SEVERITY` des 4 nouveaux types (`checkup_missing_item` = `action_required`)     |
| `src/lib/server/services/notifications.ts`                      | + `DOMAIN_OF` des 4 types (domaine `themes`)                                                |
| `src/routes/[ludo]/themes/[id]/+page.server.ts`                 | load `activeInstallation` + actions `installTheme` / `closeInstallation`                    |
| `src/routes/[ludo]/themes/[id]/+page.svelte`                    | Bouton « Installer » + bloc « Installé depuis… » + `InstallDialog` monté                    |
| `src/routes/[ludo]/themes/[id]/installations/[iid]/+page.*`     | Détail installation : sous-ensemble + nouveau check-up + historique ; action `recordCheckup` |
| `src/lib/components/themes/InstallDialog.svelte`                | Cases à cocher du sous-ensemble (tout coché par défaut), items archivés exclus              |
| `src/lib/components/themes/CheckupForm.svelte`                  | Toggle présent/manquant par item (label `Nom ×quantité`) + note                             |
| `src/lib/components/themes/CheckupHistory.svelte`              | Table date / auteur / présents / manquants                                                 |
| `src/lib/components/themes/ThemeItemList.svelte`                | Input number quantité retiré du form d'ajout (quantité visuelle ; schema conservé)          |
| `src/lib/server/services/installations.test.ts`                | 15 tests (1 install en cours, sous-ensemble vide/hors thème refusé, autorisation, check-up clôturé) |
| `src/routes/reseau/notifications/+page.svelte`                  | + deep-links des 4 nouveaux types (→ `/[slug]/themes`)                                      |

### Décisions clés (à respecter)

- **`theme_items` = liste de référence complète** (contenu total de la caisse). JAMAIS modifiée par une installation.
- **Installation = sous-ensemble sorti**, daté/historisé. Une seule `en_cours` par thème (bouton « Installer » masqué sinon).
- **Check-up = présent / manquant binaire** par item installé. Quantité dans le **label**, pas en input.
- **Autorisation install : propriétaire OU emprunteur d'un prêt actif** (`getActiveLoanToLudo`). En pratique la fiche thème est owner-only (le `load` 404 sinon), donc la branche emprunteur n'est pas exposée par l'UI pour l'instant.
- **`emitEvent` (epic 10)** journalise install/clôture/check-up dans `activity_log` ; **check-up avec ≥1 manquant → notif `action_required` aux responsables** (`recipientResponsablesOf`).
- **Notifications sans `metadata`** : les 4 types pointent vers la liste `/[slug]/themes`, pas vers l'installation précise (le `themeId` n'est dispo que dans `activity_log.metadata`).

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

- [x] 4 tables + 2 enums (`installation_status`, `checkup_item_status`) dans `schema.ts`
- [x] Relations Drizzle + types (`ThemeInstallationRow`, `ThemeCheckupRow`, …)
- [x] `pnpm db:push` vers Neon

### Phase 2 — DB + Services

- [x] `db/installations.ts` : créer installation + items, lister, détail (with check-ups), check-up actif
- [x] `services/installations.ts` :
  - `installTheme(themeId, ludoId, memberId, itemIds[], note?)` → refuse si installation `en_cours` existe ; refuse si `itemIds` vide / hors thème
  - `closeInstallationForLudo(installationId, ludoId)`
  - `recordCheckup(installationId, ludoId, memberId, statuses[], note?)` → refuse si installation clôturée
  - `getInstallationForLudo`, `listInstallationsForTheme(themeId)`
- [x] Journalisation via `emitEvent` (install / clôture / check-up)

### Phase 3 — Pages & composants

- [x] Actions installer/clôturer sur `[ludo]/themes/[id]/+page.server.ts` + bloc « Installation en cours » sur la fiche
- [x] Route détail installation (sous-ensemble + check-ups + nouveau check-up)
- [x] `InstallDialog.svelte`, `CheckupForm.svelte`, `CheckupHistory.svelte`

### Phase 4 — Tests

- [x] `services/installations.test.ts` (1 seule installation en cours, sous-ensemble vide refusé, check-up sur installation clôturée refusé) — 15 tests
- [ ] e2e : installer → check-up avec un item manquant → historique (reporté à l'epic 12)

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
