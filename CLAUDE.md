# LudoHub — Instructions Claude

## Projet

Plateforme web multi-tenant pour les ludothèques de Genève (FASE). Chaque ludo a son propre espace (slug URL, mot de passe commun, membres), avec des fonctionnalités cross-ludo pour partager des thèmes et coordonner des remplacements.

Refonte multi-tenant de `samediLudoV2` (single-tenant, auth localStorage). Public cible : staff peu technique des ludothèques genevoises.

## Stack

```
Framework :  SvelteKit 2 (SSR + API routes)
Database :   Neon (Postgres serverless) + Drizzle ORM
Auth :       Better Auth (session cookie, password partagé par ludo)
Hosting :    Vercel
Styling :    Tailwind CSS v4 + shadcn-svelte
Storage :    Vercel Blob (images thèmes, max 3/thème)
Tests :      Vitest (unit/services) + Playwright (flows critiques)
CI :         GitHub Actions (lint + typecheck + tests sur PR)
```

## Variables d'environnement requises

```
DATABASE_URL=           # Neon connection string
BETTER_AUTH_SECRET=     # Secret session Better Auth
BLOB_READ_WRITE_TOKEN=  # Vercel Blob
PUBLIC_APP_URL=         # https://ludohub.ch (ou vercel preview URL)
SUPER_ADMIN_PASSWORD=   # Mot de passe admin Jonathan
```

## Commandes utiles

```bash
pnpm dev          # Serveur de développement (NE PAS lancer — Jonathan maintient le sien)
pnpm build        # Build production
pnpm check        # Typecheck SvelteKit
pnpm lint         # ESLint + Prettier
pnpm test         # Vitest (unit)
pnpm test:e2e     # Playwright (flows critiques)
pnpm db:push      # Drizzle push schema vers Neon
pnpm db:studio    # Drizzle Studio (GUI DB)
```

## Dev Preferences

- **Ne JAMAIS lancer `npm run dev`, `bun dev`, `pnpm dev` ou tout autre serveur de développement**
- Jonathan maintient un serveur actif en permanence — pas besoin de le relancer
- Coder proprement selon les guidelines, puis attendre la validation manuelle
- Si un test nécessite de voir le rendu : indiquer "prêt à tester" et laisser Jonathan valider

## Conventions de code

### Architecture

- `+page.server.ts` = orchestration uniquement (load + actions)
- `src/lib/server/services/` = logique métier (jamais dans les routes)
- `src/lib/server/db/` = queries Drizzle (par domaine, pas de SQL brut dans les services)
- Chaque domaine a son fichier : `db/members.ts`, `services/planning.ts`, etc.

### Nommage

- Composants Svelte : PascalCase (`MemberCard.svelte`)
- Fonctions/variables : camelCase (`getActiveMembers`)
- Tables DB : snake_case pluriel (`saturday_slots`)
- Routes SvelteKit : kebab-case (`/planning/absences`)
- Types/interfaces : PascalCase avec suffixe (`MemberRow`, `AbsenceInsert`)

### Patterns

- Guards de permissions dans `src/lib/utils/permissions.ts`
- Calcul de dates suisses dans `src/lib/utils/dates.ts`
- Shadcn-svelte pour tous les composants UI standard
- Drizzle schema dans `src/lib/server/schema.ts` (source de vérité unique)

### Conventions de commits

```
feat(scope): description courte
fix(scope): correction
docs: mise à jour documentation
style: formatage uniquement
refactor(scope): refactoring sans changement de comportement
test(scope): ajout/modification de tests
chore: maintenance, dépendances
```

Exemples :

- `feat(auth): add ludo login page with member selection`
- `fix(planning): prevent double assignment on same slot`
- `test(e2e): add theme loan flow`

## Fichiers de contexte

- `docs/PRD.md` — Source de vérité du produit
- `docs/PLAN.md` — Plan d'exécution master (epics + statuts)
- `docs/HANDOFF.md` — Index léger de l'epic actif (lire en premier)
- `docs/DESIGN.md` — **Source de vérité design** (palette, typo, motion, composants)
- `src/styles/tokens.css` — Tokens CSS (couleurs, spacing, radius, ombres, motion)
- `/styleguide` — Page live de référence visuelle (noindex)
- `docs/DECISIONS.md` — Log des décisions techniques
- `docs/STYLEGUIDE.md` — Conventions étendues
- `docs/features/[nom].md` — Détail complet de chaque feature

## Règle design

**Pas de couleurs, durées ou radius en dur dans les composants — tokens uniquement.**
Toutes les valeurs visuelles sont dans `src/styles/tokens.css` et mappées via `@theme` dans `src/app.css`.

## Cycle de travail

```
1. /resume-project   → lit HANDOFF.md (index) + fichier feature actif uniquement
2. Travail sur l'epic (code, commits, checkboxes dans docs/features/[nom].md)
3. /wrap-session     → prepend bloc "Etat session" dans le fichier feature
                       + rafraîchit l'index HANDOFF.md
                       + commit
4. /clear            → nouvelle session propre
```

Règle d'or : ne JAMAIS `/clear` sans `/wrap-session`.

Structure mémoire :

- `docs/HANDOFF.md` = index léger (10 lignes) — quoi est actif, où reprendre
- `docs/features/[nom].md` = mémoire complète de chaque feature (detail, pièges, historique)

## État actuel

Epics **01-SETUP**, **02-AUTH**, **03-MEMBRES**, **04-PLANNING**, **05-ABSENCES**, **06-THÈMES**, **07-RÉSEAU**, **08-NAVIGATION**, **09-WISHLIST+MATÉRIEL**, **10-NOTIFICATIONS** et **11-ADMIN** terminés (socle SvelteKit + Drizzle + Neon ; connexion multi-tenant slug/password/membre ; CRUD membres + rôles ; planning saisons/samedis/assignations/swap ; demandes d'absence + approbation + warnings planning ; catalogue thèmes + items + photos Vercel Blob + prêts push/pull ; demandes d'aide cross-ludo ; shell de navigation partagé sidebar 104px desktop + bottom tab bar mobile couvrant `[ludo]/*` et `reseau/*` + route `/auth/logout` ; wishlist jeux `[ludo]/games` + demandes matériel `[ludo]/supplies`, nav réordonnée par usage ; notifications in-app + dispatcher unique `emitEvent` alimentant `activity_log` **et** les notifs par destinataire, badge dans le shell + page `/reseau/notifications`, sous-nav réseau Aide/Catalogue ; super-admin `/admin` protégé par cookie `ludohub_admin` distinct via groupe `(protected)` — CRUD ludothèques + reset password + journal d'activité global filtrable, composants admin réutilisables `ColorPicker`/`LudothequeCard`/`ActivityLogTable`, seed des 12 ludos genevoises réelles). Prochain epic **12-TESTS E2E** (Playwright sur les flows critiques, inclut flows admin + tests du shell reportés depuis 08 + notifs reportés depuis 10).
Repo GitHub : `github.com/jonathanvouilloz/ludohub` (branche `main`).
Voir `docs/HANDOFF.md` pour l'état courant.

**Rappel env :** côté serveur, toujours `$env/dynamic/private` (jamais `process.env`). Scripts hors SvelteKit (seed) découplés de `$env`.

**Rappel form actions :** le contexte tenant (ludo/membre) se résout dans les actions via `requireLudoContext`/`requireResponsableContext` de `src/lib/server/ludo-context.ts` — jamais `locals.ludo`/`locals.currentMember` (posés seulement par le `load` du layout, indispo avant une action en SvelteKit).
