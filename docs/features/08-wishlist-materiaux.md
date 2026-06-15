# Feature : WISHLIST JEUX + DEMANDES DE MATÉRIEL

**Epic :** 08 | **Taille :** S | **Statut :** TODO

## Description
Deux listes internes par ludo : wishlist de jeux à acheter, et demandes de matériel/fournitures. Features simples, CRUD, sans workflow d'approbation complexe.

---

## Wishlist Jeux

### Pages
- [ ] `src/routes/[ludo]/games/+page.svelte` — liste wishlist
- [ ] `src/routes/[ludo]/games/+page.server.ts` — load + actions

### Services
- [ ] `src/lib/server/services/games.ts`
  - `addGameWish(ludoId, data)` → GameWishRow
  - `markAsBought(id, buyerId)` → GameWishRow
  - `deleteGameWish(id)` → void

### Critères d'acceptation
- [ ] Jeux achetés déplacés en bas de liste (ou section dédiée)
- [ ] Lien externe cliquable (target _blank)
- [ ] Prix CHF optionnel
- [ ] Qui a marqué comme acheté + date

---

## Demandes de Matériel

### Pages
- [ ] `src/routes/[ludo]/supplies/+page.svelte` — liste des demandes
- [ ] `src/routes/[ludo]/supplies/+page.server.ts` — load + actions

### Services
- [ ] `src/lib/server/services/supplies.ts`
  - `createSupplyRequest(data)` → SupplyRequestRow
  - `updateStatus(id, status)` → SupplyRequestRow
  - `deleteRequest(id)` → void

### Critères d'acceptation
- [ ] Catégories : jeux / matériel / fournitures / autre
- [ ] Urgence : normale / haute / critique
- [ ] Statuts : en_attente → commandé → reçu
- [ ] Seul le responsable peut changer le statut

---

## Composants communs
- [ ] `WishlistItem.svelte`
- [ ] `SupplyRequestRow.svelte`
- [ ] Badges colorés pour urgence (critique = rouge, haute = orange, normale = gris)
