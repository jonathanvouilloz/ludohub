# Feature : RÉSEAU — Demandes d'aide cross-ludo

**Epic :** 07 | **Taille :** M | **Statut :** TODO

## Description

Feed cross-ludo pour les demandes de remplacement. Toutes les ludos voient le feed. Un membre publie une demande, un membre d'une autre ludo répond en volontaire, la ludo demandeuse confirme.

## Tâches

### Pages

- [ ] `src/routes/reseau/aide/+page.svelte` — feed des demandes
- [ ] `src/routes/reseau/aide/+page.server.ts` — load + actions (create, respond, confirm, cancel)

### Services

- [ ] `src/lib/server/services/help.ts`
  - `createHelpRequest(ludoId, memberId, data)` → HelpRequestRow
  - `respondToRequest(requestId, memberId, ludoId)` → HelpResponseRow
  - `confirmVolunteer(requestId, responseId)` → void (marque pourvue)
  - `cancelRequest(requestId)` → void
  - `getOpenRequests()` → { request, ludo, responses }[]
  - `getResponsesForRequest(requestId)` → { response, member, ludo }[]

### DB queries

- [ ] `src/lib/server/db/help.ts`

### Composants

- [ ] `HelpRequestFeed.svelte` — liste des demandes ouvertes
- [ ] `HelpRequestCard.svelte` — carte d'une demande
- [ ] `NewHelpRequestDialog.svelte` — formulaire de création
- [ ] `HelpResponseList.svelte` — liste des volontaires (visible par la ludo demandeuse)

## Critères d'acceptation

- [ ] Feed visible par tous les membres de toutes les ludos
- [ ] Statuts : ouverte / pourvue / annulée
- [ ] Identité du volontaire + sa ludo affichée dans la réponse
- [ ] Demandes passées filtrables/archivables
- [ ] Seule la ludo demandeuse peut confirmer un volontaire ou annuler

## Playwright tests

- [ ] Poster une demande d'aide depuis ludo A
- [ ] Répondre depuis ludo B
- [ ] Confirmer le volontaire depuis ludo A → statut "pourvue"
