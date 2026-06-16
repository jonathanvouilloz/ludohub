# Feature : WISHLIST JEUX + DEMANDES DE MATÉRIEL

**Epic :** 09 | **Taille :** S | **Statut :** PRÊT À TESTER

## Description

Deux listes internes par ludo : wishlist de jeux à acheter, et demandes de matériel/fournitures. Features simples, CRUD, sans workflow d'approbation complexe.

> **Implémenté (prêt à tester).** Divergences de nommage vs. plan initial :
> - Services : `createGameWish` / `setBought` / `setWanted` / `deleteGameWish` (wishes.ts) ;
>   `createSupplyRequest` / `updateSupplyStatus` / `deleteSupplyRequest` (supplies.ts).
> - Couche DB séparée : `db/wishes.ts`, `db/supplies.ts`. Relations + types `Insert`
>   ajoutés dans `schema.ts` (aucune migration : tables/colonnes déjà en base).
> - Dialogs : `NewGameWishDialog.svelte`, `NewSupplyDialog.svelte`.
> - Droits : wishlist ouverte à tous ; demandes créées par tous, statut responsable-only,
>   suppression par l'auteur·e ou un·e responsable.
> - Nav réordonnée par usage : tabbar = Accueil/Planning/Matériel/Jeux ; Thèmes + Réseau
>   passent dans la sheet « Plus ».
> - `pnpm check` 0 erreur/0 warning · vitest 52 tests verts (dont wishes/supplies) · eslint OK.

---

## Etat session 2026-06-16

**Fait :** Epic 09 implémenté de bout en bout — relations Drizzle + types `Insert` dans `schema.ts` (aucune migration, tables déjà en base) · couches `db/wishes.ts` + `db/supplies.ts` · services `wishes.ts`/`supplies.ts` (+ tests, 52 verts) · routes `[ludo]/games` + `[ludo]/supplies` · composants (WishlistItem, SupplyRequestRow, 2 dialogs) · nav réordonnée par usage.
**Prochain :** Validation manuelle par Jonathan sur son serveur (scénarios wishlist/matériel/nav). Si OK → passer 09 DONE dans PLAN + `/epic-recap`.
**Pieges :** Statut matériel = `Select` qui auto-submit via `requestSubmit()` (resync `$effect` sur la donnée serveur). Prix stocké en **centimes** (`priceChf`). Réseau + Thèmes ont quitté la tabbar mobile (→ sheet « Plus ») suite au reclassement d'usage demandé.
**Commit :** [ff18ed2] feat(interne): wishlist jeux + demandes de matériel (epic 09)

---

## Carte du code
> Mise a jour : 2026-06-16

| Fichier | Role |
|---------|------|
| `src/lib/server/schema.ts` | Relations `gameWishes→buyer` / `supplyRequests→member` + types `GameWishInsert`/`SupplyRequestInsert` |
| `src/lib/server/db/wishes.ts` | Queries/mutations wishlist (`with: buyer`) |
| `src/lib/server/db/supplies.ts` | Queries/mutations demandes matériel (`with: member`) |
| `src/lib/server/services/wishes.ts` | Logique wishlist : parse titre/lien http/prix→centimes, set bought/wanted |
| `src/lib/server/services/supplies.ts` | Logique matériel : validation enums, tri urgence, garde suppression auteur·e/responsable |
| `src/routes/[ludo]/games/+page.{server.ts,svelte}` | Liste souhaits + achetés en bas ; actions add/markBought/markWanted/delete |
| `src/routes/[ludo]/supplies/+page.{server.ts,svelte}` | Table demandes ; actions create/updateStatus(resp)/delete |
| `src/lib/components/games/{WishlistItem,NewGameWishDialog}.svelte` | Item wishlist + dialog création |
| `src/lib/components/supplies/{SupplyRequestRow,NewSupplyDialog}.svelte` | Ligne demande (Select statut resp) + dialog création |
| `src/lib/components/nav/nav-config.ts` | + Matériel/Jeux, réordonné par usage, Thèmes/Réseau → sheet |

### Decisions cles
- Aucune migration DB : tables `game_wishes`/`supply_requests` + enums déjà posés en 01-SETUP ; on n'ajoute que relations + types (applicatif pur).
- Droits : wishlist 100 % ouverte ; matériel créé par tous, **statut responsable-only**, suppression auteur·e OU responsable (garde dans le service).
- Prix en centimes (`integer`), formaté `CHF xx.xx` à l'affichage.

---

## Wishlist Jeux

### Pages

- [x] `src/routes/[ludo]/games/+page.svelte` — liste wishlist
- [x] `src/routes/[ludo]/games/+page.server.ts` — load + actions

### Services

- [x] `src/lib/server/services/games.ts`
  - `addGameWish(ludoId, data)` → GameWishRow
  - `markAsBought(id, buyerId)` → GameWishRow
  - `deleteGameWish(id)` → void

### Critères d'acceptation

- [x] Jeux achetés déplacés en bas de liste (ou section dédiée)
- [x] Lien externe cliquable (target \_blank)
- [x] Prix CHF optionnel
- [x] Qui a marqué comme acheté + date

---

## Demandes de Matériel

### Pages

- [x] `src/routes/[ludo]/supplies/+page.svelte` — liste des demandes
- [x] `src/routes/[ludo]/supplies/+page.server.ts` — load + actions

### Services

- [x] `src/lib/server/services/supplies.ts`
  - `createSupplyRequest(data)` → SupplyRequestRow
  - `updateStatus(id, status)` → SupplyRequestRow
  - `deleteRequest(id)` → void

### Critères d'acceptation

- [x] Catégories : jeux / matériel / fournitures / autre
- [x] Urgence : normale / haute / critique
- [x] Statuts : en_attente → commandé → reçu
- [x] Seul le responsable peut changer le statut

---

## Composants communs

- [x] `WishlistItem.svelte`
- [x] `SupplyRequestRow.svelte`
- [x] Badges colorés pour urgence (critique = rouge, haute = orange, normale = gris)
