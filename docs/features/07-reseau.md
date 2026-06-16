# Feature : RÉSEAU — Demandes d'aide cross-ludo + flow pull thèmes

**Epic :** 07 | **Taille :** M | **Statut :** DONE

## Etat session 2026-06-16

**Fait :**

- **Demandes d'aide cross-ludo** : `db/help.ts` + `services/help.ts` (`HelpServiceError`) — publier, répondre (refus si même ludo / déjà répondu / non ouverte), confirmer (→ pourvue + autres réponses auto-refusées), annuler ; route `/reseau/aide` (feed + demandes passées) + 4 composants `help/*`
- **Flow pull thèmes** (dette de 06) : enum `loan_status` + `en_attente` (db:push appliqué), `requestTheme`/`confirmLoanRequest`/`declineLoanRequest`/`cancelLoanRequest` ; bouton « Demander » + badges dans le catalogue réseau ; section « Demandes en attente » sur la fiche propriétaire
- **Nav** : lien « Demandes d'aide » sur la home + cross-links réseau ; relations Drizzle help ajoutées
- **Fixes UI post-test** : chip « en attente » thémisé (tokens warning, exclu de l'historique des prêts) ; bouton « Ajouter une photo » transformé en tuile dropzone (le variant outline paraissait transparent)
- Tests : `loans.test.ts` étendu (pull) + `help.test.ts` → **35 unit verts** ; e2e `reseau-aide.spec.ts` ; `pnpm check`/`lint` clean

**Prochain :** Epic terminé. Démarrer **08-NAVIGATION** (shell : sidebar 72px desktop + bottom tab bar mobile) — pré-requis du badge de 10-NOTIFICATIONS.
**Pièges :** e2e `reseau-aide.spec.ts` pas encore lancé (nécessite `pnpm db:seed` + le serveur de Jonathan) ; DatePicker e2e ciblé via `[data-today]`. Le shell de nav n'existe toujours pas — liens encore dans les en-têtes (08 nettoiera).
**Commit :** _(à compléter par ce wrap)_

---

## Carte du code

> Mise a jour : 2026-06-16

| Fichier                                              | Role                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/server/db/help.ts`                          | Queries demandes/réponses d'aide (feed ouvert, passées, refus en masse)  |
| `src/lib/server/services/help.ts`                    | Logique aide : publier, répondre, confirmer (auto-refus), annuler, feed  |
| `src/routes/reseau/aide/+page.server.ts`             | Orchestration feed + actions create/respond/confirm/cancel (session ctx) |
| `src/lib/components/help/`                           | HelpRequestFeed, HelpRequestCard, HelpResponseList, NewHelpRequestDialog |
| `src/lib/server/services/loans.ts`                   | + flow pull : requestTheme / confirm / decline / cancelLoanRequest       |
| `src/lib/server/db/loans.ts`                         | + `getOpenLoanForTheme` (actif\|en_attente), `setLoanStatus`             |
| `src/routes/reseau/themes/+page.server.ts`           | Catalogue réseau : annotation statut demande + action `request`          |
| `src/routes/[ludo]/themes/[id]/+page.server.ts`      | + actions `confirmRequest`/`declineRequest` (côté propriétaire)          |
| `src/lib/components/themes/ThemeImageGallery.svelte` | Upload photo en tuile dropzone thémisée (fix transparent)                |

### Decisions cles

- **Aide + pull dans le même epic** ; confirmation/annulation d'une demande d'aide = **tout membre actif** de la ludo demandeuse (pas de gating responsable) ; à la confirmation d'un volontaire, les **autres réponses passent `refuse`** automatiquement.
- **Pull** : la demande crée un prêt `en_attente` que le propriétaire confirme → `actif`. `getOpenLoanForTheme` (actif|en_attente) bloque à la fois un nouveau push et un nouveau pull tant qu'un prêt est ouvert. Demandes en attente exclues de l'historique des prêts (section dédiée).
- **États « en attente »** thémisés via tokens `--warning`/`--warning-light` (pas le variant outline transparent).
- Routes `/reseau/*` → contexte via `requireSessionContext` (pas de slug `[ludo]`).

## Description

Feed cross-ludo pour les demandes de remplacement. Toutes les ludos voient le feed. Un membre publie une demande, un membre d'une autre ludo répond en volontaire, la ludo demandeuse confirme. Inclut le flow pull/request des prêts de thèmes reporté depuis l'epic 06.

## Tâches

### Pages

- [x] `src/routes/reseau/aide/+page.svelte` — feed des demandes
- [x] `src/routes/reseau/aide/+page.server.ts` — load + actions (create, respond, confirm, cancel)

### Services

- [x] `src/lib/server/services/help.ts`
  - `publishHelpRequest(ludoId, data)` → HelpRequestRow
  - `respondToRequest(requestId, memberId, responderLudoId)` → HelpResponseRow
  - `confirmVolunteer(requestId, responseId, requestingLudoId)` → void (marque pourvue + auto-refus)
  - `cancelRequest(requestId, requestingLudoId)` → void
  - `getFeed(currentLudoId, currentMemberId)` (annoté isMine / myResponse) + `getPastForLudo`
- [x] `src/lib/server/services/loans.ts` (flow pull) — `requestTheme`, `confirmLoanRequest`, `declineLoanRequest`, `cancelLoanRequest`

### DB queries

- [x] `src/lib/server/db/help.ts`
- [x] `src/lib/server/db/loans.ts` (+ `getOpenLoanForTheme`, `setLoanStatus`)

### Composants

- [x] `HelpRequestFeed.svelte` — liste des demandes ouvertes
- [x] `HelpRequestCard.svelte` — carte d'une demande
- [x] `NewHelpRequestDialog.svelte` — formulaire de création
- [x] `HelpResponseList.svelte` — liste des volontaires (visible par la ludo demandeuse)

## Critères d'acceptation

- [x] Feed visible par tous les membres de toutes les ludos
- [x] Statuts : ouverte / pourvue / annulée
- [x] Identité du volontaire + sa ludo affichée dans la réponse
- [x] Demandes passées filtrables/archivables (section « Mes demandes passées »)
- [x] Seule la ludo demandeuse peut confirmer un volontaire ou annuler

## Playwright tests

- [x] Poster une demande d'aide depuis ludo A
- [x] Répondre depuis ludo B
- [x] Confirmer le volontaire depuis ludo A → statut "pourvue"
