# Feature : SETUP — Socle technique

**Epic :** 01 | **Taille :** M | **Statut :** EN COURS

---

## État session 2026-06-15

**Fait :**
- Projet SvelteKit 2 + Svelte 5 initialisé manuellement (tous les fichiers créés à la main)
- `package.json` complet — dépendances : drizzle-orm 0.45.x, @neondatabase/serverless, better-auth 1.6, tailwindcss 4, vitest 4 (Vite 6 compatible)
- `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `drizzle.config.ts`, `.env.example`, `.gitignore`, `.prettierrc`, `eslint.config.js`, `playwright.config.ts`
- `src/lib/server/schema.ts` — 19 tables + 11 enums Drizzle, incluant les 4 tables Better Auth
- `src/lib/server/db/index.ts` — connexion Neon HTTP
- `src/lib/server/auth.ts` — Better Auth configuré avec drizzleAdapter
- `src/hooks.server.ts` — middleware session (routage /api/auth/* + locals.session)
- `src/app.html`, `src/app.css` (Tailwind v4 + @theme mapping tokens), `src/app.d.ts`
- `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/api/health/+server.ts`
- `src/lib/utils/dates.ts` (getSwissSaturdays, formatDateCH, toDateString...)
- `src/lib/utils/permissions.ts` (isResponsable, isActiveMember, belongsToLudo)
- Stubs DB : `db/ludotheques.ts`, `db/members.ts`, `db/planning.ts`, `db/absences.ts`, `db/themes.ts`
- Stubs services : `services/planning.ts`, `services/absences.ts`, `services/themes.ts`, `services/help.ts`
- `pnpm check` → **0 erreurs, 0 warnings** ✅

**Reste :**
- [ ] `pnpm db:push` — pousser le schema vers Neon dev (besoin de DATABASE_URL)
- [ ] Vérifier les tables dans Drizzle Studio
- [ ] Tester `/api/health` en dev

**Pièges actifs :**
- vitest upgradé à v4 (latest) pour compatibilité Vite 6 — ne pas rétrograder
- better-auth v1.6 exige drizzle-orm@^0.45 — pinné à 0.45.x
- shadcn-svelte non installé (composants ajoutés feature par feature via CLI)

---

## Carte du code
> Mise à jour : 2026-06-15

| Fichier | Rôle |
|---------|------|
| `src/lib/server/schema.ts` | Source de vérité unique — 19 tables Drizzle + 11 enums + types utilitaires |
| `src/lib/server/db/index.ts` | Connexion Neon HTTP via `neon()` + instance `db` Drizzle exportée |
| `src/lib/server/auth.ts` | Better Auth configuré avec `drizzleAdapter` (tables BA dans schema.ts) |
| `src/hooks.server.ts` | Middleware SvelteKit : route `/api/auth/*` → Better Auth, session → `locals.session` |
| `src/app.css` | Tailwind v4 + `@theme` mapping vers les tokens CSS de `tokens.css` |
| `src/lib/utils/dates.ts` | `getSwissSaturdays()`, `formatDateCH()`, `toDateString()` |
| `src/lib/utils/permissions.ts` | Guards `isResponsable()`, `isActiveMember()`, `belongsToLudo()` |
| `src/lib/server/db/ludotheques.ts` | Queries Drizzle : lookup par slug/id, liste, création |
| `src/lib/server/db/members.ts` | Queries Drizzle : actifs par ludo, CRUD membres |
| `src/lib/server/services/planning.ts` | `createSeasonWithSlots()`, `assignMember()`, `swapMembers()` |
| `drizzle.config.ts` | Config drizzle-kit : dialect postgresql, schema + migrations path |

### Décisions clés
- Better Auth v1.6 exige `drizzle-orm@^0.45` et `drizzle-kit@>=0.31` — ne pas rétrograder
- `vitest` doit être en v3+ (v4 installé) — Vite 6 incompatible avec vitest v2
- `shadcn-svelte` non installé globalement : ajouter les composants à la demande via `pnpm dlx shadcn-svelte@latest add [component]`
- Le flow auth (ludo password → member pick) est dans `02-AUTH`, pas ici — Better Auth gère uniquement les sessions

---

## Description
Initialisation complète du projet SvelteKit : structure de fichiers, Drizzle schema, connexion Neon, Better Auth config de base, variables d'environnement, et page de santé. Socle sur lequel toutes les autres features s'appuient.

## Tâches

### Infrastructure
- [x] `pnpm create svelte@latest` — SvelteKit 2, TypeScript strict (initialisé manuellement)
- [x] Installer dépendances : `drizzle-orm`, `@neondatabase/serverless`, `better-auth`, `drizzle-kit`
- [ ] Installer shadcn-svelte (à faire feature par feature)
- [x] Tailwind CSS v4 configuré
- [x] Configurer `.env.example` avec toutes les variables

### Database
- [x] Écrire `src/lib/server/schema.ts` — schema Drizzle complet (toutes les tables du PRD)
- [x] Configurer `drizzle.config.ts` (Neon + migrations)
- [ ] `pnpm db:push` — pousser le schema vers Neon dev ← **PROCHAIN**
- [ ] Vérifier les tables dans Drizzle Studio

### Auth (socle)
- [x] Configurer `src/lib/server/auth.ts` — Better Auth avec drizzleAdapter
- [x] Créer les tables Better Auth (user, session, account, verification) dans le schema
- [x] Hook `src/hooks.server.ts` — middleware session

### Structure de base
- [x] Créer la structure de dossiers `src/lib/server/{db,services}/`
- [x] Créer `src/lib/utils/dates.ts` (stub avec `getSwissSaturdays()`)
- [x] Créer `src/lib/utils/permissions.ts` (guards `isResponsable`, `isMember`)
- [x] Page `src/routes/+layout.svelte` — layout racine
- [x] Route de santé `src/routes/api/health/+server.ts` → `{ ok: true, version: '0.1.0' }`

### Scripts npm
- [x] Ajouter `db:push`, `db:studio`, `db:generate` dans `package.json`

## Décisions techniques
- Drizzle ORM (pas Prisma) — cf. docs/DECISIONS.md
- Neon serverless driver (`@neondatabase/serverless`) pour les edge functions Vercel
- Better Auth v1.6 avec drizzleAdapter — 4 tables BA dans schema.ts (user, session, account, verification)
- Le flow auth custom (ludo password → member selection) est dans la feature 02-AUTH, pas ici
- shadcn-svelte : pas préinstallé globalement, composants ajoutés au besoin via `pnpm dlx shadcn-svelte@latest add`

## Notes et edge cases
- Le schema Drizzle est la **source de vérité unique** — pas de migrations manuelles
- `is_active` sur members : soft delete, jamais de suppression physique si assignations existent
- Les slugs de ludo sont créés en minuscules sans accent (`paquis`, `champel`, etc.)
- Neon : utiliser `neon()` du driver HTTP en production, `Pool` pour les migrations

## Commandes de vérification
```bash
pnpm check          # 0 erreur TypeScript ✅
pnpm db:push        # schema poussé sans erreur (besoin DATABASE_URL)
curl /api/health    # { ok: true }
```
