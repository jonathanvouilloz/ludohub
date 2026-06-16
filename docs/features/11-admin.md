# Feature : ADMIN — Super administration

**Epic :** 09 | **Taille :** M | **Statut :** TODO

## Description

Interface super admin pour Jonathan. Création et configuration des ludothèques (slug, couleur, mot de passe initial). Accès aux logs d'activité globaux. Protégé par un mot de passe admin distinct (`SUPER_ADMIN_PASSWORD`).

## Tâches

### Pages

- [ ] `src/routes/admin/+layout.server.ts` — vérification SUPER_ADMIN_PASSWORD
- [ ] `src/routes/admin/+page.svelte` — dashboard admin
- [ ] `src/routes/admin/ludotheques/+page.svelte` — liste + création
- [ ] `src/routes/admin/ludotheques/[id]/+page.svelte` — édition (couleur, password reset)
- [ ] `src/routes/admin/logs/+page.svelte` — logs d'activité globaux

### Services

- [ ] `src/lib/server/services/admin.ts`
  - `createLudotheque(data)` → LudoRow
  - `updateLudotheque(id, data)` → LudoRow
  - `resetLudoPassword(id, newPassword)` → void
  - `getGlobalActivityLog(limit)` → ActivityLogRow[]

### DB queries

- [ ] `src/lib/server/db/ludotheques.ts` (étendre)
  - `getAllLudos()` → LudoRow[]
  - `insertLudo(data)` → LudoRow
  - `updateLudoById(id, data)` → LudoRow

### Composants

- [ ] `LudothequeCard.svelte` (admin)
- [ ] `ActivityLogTable.svelte`
- [ ] `ColorPicker.svelte` — sélection couleur par ludo

## Critères d'acceptation

- [ ] Accès `/admin` protégé par `SUPER_ADMIN_PASSWORD` (session admin distincte)
- [ ] CRUD complet des ludothèques
- [ ] Reset mot de passe d'une ludo
- [ ] Logs d'activité consultables avec filtres ludo + type
- [ ] Slugs validés : lowercase, sans accents, sans espaces, uniques

## Notes

- L'onboarding autonome d'une nouvelle ludo est en V2 (hors scope MVP)
- Jonathan créera manuellement les 12 ludos initiales via l'interface admin
- Le slug est généré depuis le nom mais reste éditable avant validation
