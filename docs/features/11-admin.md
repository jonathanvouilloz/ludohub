# Feature : ADMIN — Super administration

**Epic :** 11 | **Taille :** M | **Statut :** EN COURS

## Etat session 2026-06-17 (phase 3)

**Fait :**

- Phase 3 (pages métier) terminée. 3 écrans branchés sur `admin.ts` :
  - `ludotheques/+page` : liste (table nom/slug/couleur+pastille/adresse/date) + état vide + dialog de création inline (calque `MemberDialog`). Action `create`.
  - `ludotheques/[id]/+page` : load `getLudotheque` (→ `error(404)` si introuvable), form « Informations » (nom/couleur/adresse, action `update`) + form « Reset password » séparé (action `resetPassword`, vérifie confirmation, feedback dédié `passwordError`/`passwordSuccess`). Slug affiché en lecture seule (Badge « non modifiable »).
  - `logs/+page` : filtres en `method="GET"` (select ludo + input action), table date/ludo/action/entité/métadonnées, résolution id→nom via Map, limite 200 signalée.
- Dashboard `(protected)/+page` : les 2 `todo` remplacés par de vrais liens-cartes vers `/admin/ludotheques` et `/admin/logs`.
- Couleur : `<input type="color">` natif + champ hexa liés via `$state` (le service valide `#RRGGBB`).
- `pnpm check` **0 erreur / 0 warning**, eslint OK, **85 tests verts** (aucune logique métier nouvelle).

**Prochain :** Phase 4 — extraction composants réutilisables (`LudothequeCard`, `ActivityLogTable`, `ColorPicker`) + polish. Puis epic 12 (tests E2E, dont flows admin).

**Pieges :** `<input type="color">` n'émet que `#rrggbb` lowercase ; le champ hexa libre reste source de vérité pour la validation serveur. Pour les forms multi-actions sur `[id]`, feedback dédié par clé (`error`/`success` vs `passwordError`/`passwordSuccess`) pour ne pas mélanger les bannières.

**Commit :** (à venir — phase 3)

---

## Etat session 2026-06-17 (phases 1-2)

**Fait :**

- Phase 1 (socle serveur) : `normalizeSlug` + util, `db.updateLudoById`, `db.getGlobalActivityLog` (filtres ludo/action), service `admin.ts` (createLudotheque/updateLudotheque/resetLudoPassword/getGlobalActivityLog/list/get), service `admin-auth.ts` (cookie signé `ludohub_admin`, `verifyAdminPassword`).
- Phase 2 (auth de bout en bout) : `requireAdminContext` + `locals.adminSession` posé dans `hooks.server.ts` (sous `/admin`), routes `/admin/login` (+action), `/admin/logout`, garde via groupe `(protected)` (URLs inchangées), dashboard stub.
- Tests : `slug.test.ts` (6), `admin.test.ts` (9), `admin-auth.test.ts` (6). **85 tests verts**, `pnpm check` + lint OK.
- Slug non éditable après création (décision : protège URLs/sessions).

**Prochain :** Phase 3 — pages métier sous `src/routes/admin/(protected)/` : `ludotheques/+page` (liste + création), `ludotheques/[id]/+page` (édition couleur/adresse + reset password), `logs/+page` (lecture `getGlobalActivityLog` + filtres). Brancher les actions sur le service `admin.ts`. Puis phase 4 composants (`LudothequeCard`, `ActivityLogTable`, `ColorPicker`).

**Pieges :** Login HORS du layout gardé (sinon boucle de redirection) → c'est le rôle du groupe `(protected)`. `SUPER_ADMIN_PASSWORD` doit être dans l'env local pour tester. `pnpm format` reformate tout le repo → cibler les fichiers.

**Commit :** [9daa59d] feat(admin): auth super-admin de bout en bout (epic 11)

---

## Description

Interface super admin pour Jonathan. Création et configuration des ludothèques (slug, couleur, mot de passe initial). Accès aux logs d'activité globaux. Protégé par un mot de passe admin distinct (`SUPER_ADMIN_PASSWORD`).

## Tâches

### Pages

- [x] Garde `SUPER_ADMIN_PASSWORD` — `src/routes/admin/(protected)/+layout.server.ts` (via `requireAdminContext`)
- [x] `src/routes/admin/login/` + `logout/` — auth admin (cookie distinct)
- [x] `src/routes/admin/(protected)/+page.svelte` — dashboard (liens actifs vers ludothèques + logs)
- [x] `src/routes/admin/(protected)/ludotheques/+page.svelte` — liste + création (dialog)
- [x] `src/routes/admin/(protected)/ludotheques/[id]/+page.svelte` — édition (couleur, adresse) + reset password
- [x] `src/routes/admin/(protected)/logs/+page.svelte` — logs d'activité globaux + filtres

### Services

- [x] `src/lib/server/services/admin.ts`
  - `createLudotheque(data)` → LudothequeRow
  - `updateLudotheque(id, data)` → LudothequeRow
  - `resetLudoPassword(id, newPassword)` → void
  - `getGlobalActivityLog(opts)` → ActivityLogRow[] ; + `listLudotheques`, `getLudotheque`
- [x] `src/lib/server/services/admin-auth.ts` — session admin (cookie signé)

### DB queries

- [x] `src/lib/server/db/ludotheques.ts` (étendre)
  - `getAllLudos()` → existait ; `createLudo` → existait (couvre `insertLudo`)
  - `updateLudoById(id, data)` → ajouté
- [x] `src/lib/server/db/activity_log.ts` — `getGlobalActivityLog(opts)` (filtres ludo/action)
- [x] `src/lib/utils/slug.ts` — `normalizeSlug`

### Composants

- [ ] `LudothequeCard.svelte` (admin)
- [ ] `ActivityLogTable.svelte`
- [ ] `ColorPicker.svelte` — sélection couleur par ludo

## Critères d'acceptation

- [x] Accès `/admin` protégé par `SUPER_ADMIN_PASSWORD` (session admin distincte)
- [x] CRUD complet des ludothèques (liste + création dialog + édition page)
- [x] Reset mot de passe d'une ludo (form dédié sur la page `[id]`)
- [x] Logs d'activité consultables avec filtres ludo + action
- [x] Slugs validés : lowercase, sans accents, sans espaces, uniques

## Carte du code

> Mise a jour : 2026-06-17

| Fichier                                 | Role                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `src/lib/utils/slug.ts`                 | `normalizeSlug` — dérive/normalise un slug d'URL depuis un nom            |
| `src/lib/server/db/ludotheques.ts`      | `updateLudoById` (+ `getAllLudos`/`createLudo` réutilisés)                |
| `src/lib/server/db/activity_log.ts`     | `getGlobalActivityLog` — lecture journal global, filtres ludo/action      |
| `src/lib/server/services/admin.ts`      | Logique métier : CRUD ludothèques, reset password, lecture logs           |
| `src/lib/server/services/admin-auth.ts` | Session super-admin : cookie signé `ludohub_admin`, `verifyAdminPassword` |
| `src/lib/server/admin-context.ts`       | `requireAdminContext` — garde de route (redirect `/admin/login`)          |
| `src/hooks.server.ts`                   | Pose `locals.adminSession` (lue uniquement sous `/admin`)                 |
| `src/routes/admin/login/`               | Page + action login (mot de passe → cookie)                               |
| `src/routes/admin/logout/+server.ts`    | POST logout (clear cookie)                                                |
| `src/routes/admin/(protected)/`         | Zone gardée : layout (garde) + dashboard (liens ludothèques/logs)         |
| `src/routes/admin/(protected)/ludotheques/`      | Liste + dialog création (load `listLudotheques`, action `create`)         |
| `src/routes/admin/(protected)/ludotheques/[id]/` | Édition (nom/couleur/adresse) + reset password (`update`/`resetPassword`) |
| `src/routes/admin/(protected)/logs/`             | Journal global + filtres GET (ludo/action), résolution id→nom             |

### Decisions cles

- **Cookie admin distinct** (`ludohub_admin`), pas Better Auth — calque du mécanisme session ludo (`auth.ts`), signé avec `BETTER_AUTH_SECRET`, 7 j.
- **Groupe de routes `(protected)`** pour garder `/admin/*` tout en laissant `/admin/login` public → évite la boucle de redirection. Les groupes n'affectent pas l'URL.
- **Slug non éditable après création** (URLs + sessions en dépendent).
- **Pas d'audit des actions admin** : `activity_log` reste alimenté uniquement par `emitEvent` ; l'admin se contente de lire.

## Notes

- L'onboarding autonome d'une nouvelle ludo est en V2 (hors scope MVP)
- Jonathan créera manuellement les 12 ludos initiales via l'interface admin
- Le slug est généré depuis le nom mais reste éditable avant validation
