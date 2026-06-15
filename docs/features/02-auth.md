# Feature : AUTH — Connexion multi-tenant

**Epic :** 02 | **Taille :** M | **Statut :** DONE ✅

## Etat session 2026-06-15

**Fait :**

- Flow auth multi-tenant complet : login brandé `/auth/[slug]` (password partagé → liste membres → sélection) → dashboard `/[slug]`.
- Service `services/auth.ts` : `verifyLudoPassword`, cookie signé HMAC (`better-auth/crypto`), `set/read/clearLudoSession`.
- Middleware `[ludo]/+layout.server.ts` (garde slug 404 / session / membre actif) + injection `--ludo-color`.
- Composants `LoginForm` / `MemberPicker` (tokens uniquement) + tests Playwright `e2e/auth.spec.ts`.
- **Fix env** : passage à `$env/dynamic/private` (process.env ne marche pas en dev SvelteKit) + seed découplé sous tsx.
- **Validé par Jonathan : connexion au dashboard OK.**

**Prochain :** Epic suivant selon `PLAN.md` (03-MEMBRES — gestion des membres par ludo). Cet epic est clos.
**Pièges :** voir section « Pièges / à savoir » — règle env `$env/*` côté serveur ; ESLint cassé dans le repo (`@eslint/js` absent, à corriger hors epic).
**Commit :** _(à venir, ce wrap)_

---

## Carte du code

> Mise a jour : 2026-06-15

| Fichier                                       | Role                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/server/services/auth.ts`             | Cœur AUTH : vérif password ludo + cookie de session signé (sign/read/set/clear)  |
| `src/routes/auth/[ludo]/+page.server.ts`      | Load (vérif slug) + actions `checkPassword` / `login`                            |
| `src/routes/auth/[ludo]/+page.svelte`         | Page login brandée, orchestre LoginForm → MemberPicker                           |
| `src/routes/[ludo]/+layout.server.ts`         | Middleware tenant : garde slug/session/membre, set `locals.ludo`/`currentMember` |
| `src/routes/[ludo]/+layout.svelte`            | Wrapper qui injecte `--ludo-color`                                               |
| `src/routes/[ludo]/+page.svelte`              | Dashboard placeholder (cible post-login)                                         |
| `src/lib/components/auth/LoginForm.svelte`    | Formulaire mot de passe (étape 1)                                                |
| `src/lib/components/auth/MemberPicker.svelte` | Liste de boutons membres (étape 2)                                               |
| `src/hooks.server.ts`                         | Attache `locals.ludoSession` (lecture cookie) + délègue `/api/auth/*`            |
| `src/app.d.ts`                                | Types `App.Locals` : `ludoSession`, `ludo`, `currentMember`                      |
| `src/lib/server/db/seed.ts`                   | Seed dev autonome (paquis + membres), tourne sous tsx                            |

### Decisions cles

- Session = cookie signé custom (pas Better Auth), hashing scrypt via `better-auth/crypto`. Voir Décisions techniques.
- **Côté serveur : toujours `$env/dynamic/private`, jamais `process.env`** (sinon `not set` en dev).
- Scripts hors SvelteKit (seed) doivent être découplés de `$env` (client neon propre + dotenv).

---

## Description

Système d'authentification multi-tenant. Chaque ludo a un slug URL unique et un mot de passe commun. Le flow : accès à `/[slug]` → page de connexion brandée → saisie du mot de passe ludo → sélection du membre → dashboard.

## Tâches

### Pages

- [x] `src/routes/auth/[ludo]/+page.svelte` — page de connexion par slug
  - Header avec couleur + nom de la ludo (`--ludo-color`)
  - Champ mot de passe
  - Liste des membres actifs (apparaît après vérification du password)
  - Message d'erreur générique si mot de passe incorrect
- [x] `src/routes/auth/[ludo]/+page.server.ts` — load (vérif slug) + actions `checkPassword` / `login`
- [x] `src/routes/[ludo]/+page.svelte` — dashboard placeholder (cible du redirect après login)

### Middleware

- [x] `src/routes/[ludo]/+layout.server.ts`
  - Vérifier que le slug existe → 404 si non
  - Vérifier la session → redirect `/auth/[ludo]` si non connecté
  - Injecter `ludo` et `currentMember` dans les locals
- [x] `src/routes/[ludo]/+layout.svelte` — wrapper qui injecte `--ludo-color`

### Services

- [x] `src/lib/server/services/auth.ts`
  - `verifyLudoPassword(slug, password)` → `{ ludo, members } | null`
  - `setLudoSessionCookie(cookies, { ludoId, memberId })` (cookie signé HMAC)
  - `readLudoSession(cookies)` → `{ ludoId, memberId } | null`
  - `clearLudoSession(cookies)` (logout) + `hashLudoPassword` (seed)

### DB queries

- [x] `src/lib/server/db/ludotheques.ts` — `getLudoBySlug` (déjà fait au SETUP)
- [x] `src/lib/server/db/members.ts` — `getActiveMembersByLudo`, `getMemberById` (déjà fait au SETUP)

### Composants

- [x] `src/lib/components/auth/LoginForm.svelte` — formulaire de connexion
- [x] `src/lib/components/auth/MemberPicker.svelte` — liste de sélection du membre (boutons)

## Décisions techniques

- **Session = cookie signé custom** `ludohub_session` (HMAC-SHA256 via `makeSignature` de `better-auth/crypto`, clé = `BETTER_AUTH_SECRET`), httpOnly, 30 jours, payload `{ ludoId, memberId }`. Better Auth n'est PAS utilisé pour ce flow (réservé super-admin futur), mais reste câblé sur `/api/auth/*`.
- **Hashing du password ludo = `hashPassword`/`verifyPassword` de `better-auth/crypto`** (scrypt, edge-compatible). Pas de bcrypt ajouté. La colonne reste `ludotheques.passwordHash`.
- `secure` du cookie laissé à SvelteKit (true en https, toléré sur http://localhost en dev) — ne pas forcer `secure: true` sinon le cookie n'est pas posé en dev.
- Flow 2 étapes sur une page : `checkPassword` (renvoie les membres) → `login` (re-vérifie password + memberId → pose la session). Password gardé en champ caché entre les 2 étapes.
- MemberPicker = **liste de boutons** (pas `<select>`) — meilleure UX staff peu technique.
- shadcn-svelte non initialisé (CLI interactif) → composants auth en HTML stylé aux tokens. À migrer vers shadcn plus tard si besoin.
- Slug inexistant → `error(404, 'Ludothèque introuvable')`
- Aucun membre actif → message "Contactez votre responsable"

## Pièges / à savoir

- **Env en dev SvelteKit** : Vite ne peuple PAS `process.env` avec le `.env` côté serveur. Le code SETUP lisait `process.env.DATABASE_URL` / `BETTER_AUTH_SECRET` → `Error: DATABASE_URL is not set` au 1er hit SSR de la DB. Corrigé : `db/index.ts`, `auth.ts`, `services/auth.ts` utilisent `$env/dynamic/private` (et `$env/dynamic/public` pour `PUBLIC_APP_URL`). **Toujours utiliser `$env/*` côté serveur**, jamais `process.env` directement.
- **Seed découplé** : `db/seed.ts` tourne sous tsx (hors SvelteKit) → il ne peut PAS importer `$env`. Il crée donc son propre client neon + `dotenv` et n'importe aucun module runtime SvelteKit (ni `db/index.ts`, ni `services/auth.ts`). Il hache via `hashPassword` de `better-auth/crypto` en direct.
- **ESLint cassé dans le repo** : `@eslint/js` absent de `package.json` (gap pré-existant, hors scope AUTH) → `pnpm lint` échoue à l'étape eslint. `pnpm check` (typecheck) passe à 0 erreur.
- `prettier --check` global signale plein de fichiers pré-existants non formatés (docs, schema.ts…) — non touchés ici.
- **Tester nécessite de seeder** : `pnpm db:seed` crée la ludo `paquis` (password `paquis2026`) + 3 membres actifs + 1 inactif. Script idempotent.

## Critères d'acceptation (validés par Jonathan — connexion dashboard OK)

- [x] URL slug unique et non-modifiable
- [x] Mauvais mot de passe → message générique (pas "mot de passe incorrect" détaillé)
- [x] Membre désactivé → non visible dans la liste
- [x] Session persistée 30 jours
- [x] Slug inconnu → 404

## Playwright tests (flows critiques) — écrits dans `e2e/auth.spec.ts`

- [x] Flow complet : `/paquis` → password → pick name → dashboard
- [x] Mauvais password → erreur affichée
- [x] Slug inconnu → 404
