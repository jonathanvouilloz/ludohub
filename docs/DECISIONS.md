# Décisions techniques — LudoHub

Format : `Date | Décision | Contexte | Alternatives considérées`

---

## 2026-06-15 | Auth par mot de passe partagé par ludo (Better Auth)

**Contexte :** Les ludothèques ont un staff peu technique. Créer un compte individuel par membre crée de la friction et des mots de passe oubliés. Le modèle existant (`samediLudoV2`) utilisait localStorage — non sécurisé et non scalable.

**Décision :** Un mot de passe unique par ludo (haché bcrypt). L'utilisateur saisit le mot de passe commun, puis choisit son nom dans la liste des membres actifs. Session cookie httpOnly 30 jours.

**Alternatives :** Auth individuelle email/password (trop de friction), magic link (complexité infra email), SSO FASE (dépendance externe non garantie).

---

## 2026-06-15 | Multi-tenant par slug URL (pas de sous-domaine)

**Contexte :** 12 ludos connues, nombre limité. Les ludos sont créées manuellement par le super admin (Jonathan).

**Décision :** `ludohub.ch/[slug]` — route dynamique `[ludo]` dans SvelteKit. Plus simple à gérer côté Vercel qu'un sous-domaine dynamique. Slug non-modifiable après création.

**Alternatives :** Sous-domaines dynamiques (`paquis.ludohub.ch`) — complexité DNS/Vercel disproportionnée pour 12 entités.

---

## 2026-06-15 | Neon (Postgres serverless) + Drizzle ORM

**Contexte :** Vercel deployment, besoin d'un Postgres managé avec connection pooling intégré pour les serverless functions.

**Décision :** Neon + Drizzle. Neon gère le pooling, Drizzle donne un type-safety complet sur le schema. Pas de Prisma (overhead + cold starts).

**Alternatives :** PlanetScale (MySQL, pas de FK), Supabase (overkill, auth redondante avec Better Auth), Turso (SQLite, limites sur requêtes complexes cross-ludo).

---

## 2026-06-15 | Vercel Blob pour les photos de thèmes (max 3/thème)

**Contexte :** Les thèmes ont besoin de photos pour les présenter aux autres ludos. Besoin simple : upload, URL publique, suppression.

**Décision :** Vercel Blob — intégration native Vercel, pas de config S3 supplémentaire. Limite : 3 photos max par thème, 5MB chacune.

**Alternatives :** Cloudinary (CDN + transformations — overkill), S3 direct (config IAM complexe), uploadthing (dépendance supplémentaire).

---

## 2026-06-15 | Versions dépendances critiques

**Contexte :** Conflits de peers découverts lors du setup initial.

**Décision :** `drizzle-orm@^0.45`, `drizzle-kit@>=0.31`, `vitest@^3` (v4 installé). Better Auth v1.6 exige drizzle-orm 0.45+ ; vitest v2 est incompatible avec Vite 6 (types Plugin conflictuels).

**Alternatives :** Rester sur drizzle-orm 0.40 + better-auth 1.2 — écarté car versions trop en retard sur l'écosystème.

---

## 2026-06-15 | Session AUTH = cookie signé custom (pas Better Auth), hashing scrypt

**Contexte :** Le flow ludo est « mot de passe partagé + sélection de membre », sans compte individuel. Le modèle natif de Better Auth (email/password par user) ne colle pas. Décision prise pendant l'implémentation de 02-AUTH (révise l'entrée « Auth par mot de passe partagé » qui prévoyait bcrypt + Better Auth).

**Décision :** Cookie signé custom `ludohub_session` (HMAC-SHA256 via `makeSignature` de `better-auth/crypto`, clé = `BETTER_AUTH_SECRET`), payload `{ ludoId, memberId }`, httpOnly 30j. Hashing du password ludo via `hashPassword`/`verifyPassword` de `better-auth/crypto` (scrypt, edge-compatible) — pas de bcrypt. Better Auth reste câblé sur `/api/auth/*` pour un super-admin futur.

**Alternatives :** Better Auth user-par-ludo (sélection de membre tortueuse), hybride sur la table session Better Auth (couplage inutile), bcryptjs (dépendance native évitée).

---

## 2026-06-15 | Accès env serveur via `$env/*`, jamais `process.env`

**Contexte :** En dev SvelteKit, Vite ne peuple pas `process.env` avec le `.env`. Le code SETUP lisait `process.env.DATABASE_URL` → `Error: not set` au 1er accès SSR DB.

**Décision :** Côté serveur SvelteKit, toujours `$env/dynamic/private` (et `$env/dynamic/public` pour `PUBLIC_*`). Les scripts hors runtime (seed via tsx) restent autonomes : client neon propre + `dotenv`, sans importer de module `$env`.

**Alternatives :** Forcer le chargement de `.env` dans process.env (fragile, ordre de boot), `$env/static` (moins souple pour Vercel runtime).

---

## 2026-06-15 | shadcn-svelte mappé sur les tokens LudoHub (pas la palette par défaut)

**Contexte :** La CLI shadcn-svelte n'avait jamais été lancée avant 03-MEMBRES (besoin de table, input, dialog, select, alert-dialog, badge, checkbox). En v1.3.0 l'init exige un « design system preset » interactif (chaîne base64 du site) que ni `--base-color` ni l'ancien preset documenté ne contournent — l'init purement non-interactif n'était pas possible.

**Décision :** Setup manuel déterministe — `components.json` + `src/lib/utils/cn.ts` écrits à la main, puis `npx shadcn-svelte add -y …` (qui lit `components.json`, pas de preset requis). Le mapping sémantique shadcn est branché sur nos tokens dans `@theme` (`src/app.css`) : `--color-primary`→`--primary`, `--color-destructive`→`--danger`, `--color-border`→`--border`, etc. L'`accent` shadcn = surface de hover (`--bg-hover`), **pas** le magenta de marque ; le magenta reste exposé en `--color-brand*`. `cn` placé dans `$lib/utils/cn` (coexiste avec le dossier `utils/`). `@custom-variant dark` figé sur `.dark` (jamais ajoutée) pour empêcher tout dark: accidentel. Aucune palette grise par défaut introduite.

**Alternatives :** `--preset <base64>` (chaîne fragile, schéma v1.3 non documenté), piper les réponses au prompt clack (non fiable en raw mode), accepter la palette neutre par défaut puis tout réécrire (double travail). Composant `form/` écarté (tire formsnap + sveltekit-superforms) — on utilise les form actions SvelteKit natives.

---

## 2026-06-16 | Planning : consultation ouverte à tous, mutations responsable-only ; swap atomique via db.batch

**Contexte :** Epic 04-PLANNING. Le doc feature impliquait une vue responsable et une vue membre séparées ; en test, un membre simple était bloqué (403) sur le planning. Le driver `neon-http` ne supporte pas les transactions interactives, or le swap doit être atomique.

**Décision :** Tout membre connecté **consulte** le planning (grille + ses prochains samedis) ; seules les **mutations** (saisons, assignations, annulations, swap) sont réservées aux responsables (garde `requireContext` dans les actions). Swap croisé entre deux samedis distincts, atomique via `db.batch()`. Saisons archivables (`isArchived`, lecture seule). Warnings d'absences reportés à l'epic 05.

**Alternatives :** Vue planning entièrement responsable-only (rejetée : les membres veulent consulter), swap via deux UPDATE séquentiels (non atomique, risque d'état incohérent), `db.transaction()` (non supporté par neon-http).

---

## 2026-06-16 | Contexte tenant dans les `load` enfants via `await parent()`, jamais `locals`

**Contexte :** Le 403 du planning venait de `load` enfants lisant `locals.ludo`/`locals.currentMember` posés par `[ludo]/+layout.server.ts` après deux `await`. Les `load` SvelteKit s'exécutant en parallèle, le `load` enfant lisait `locals` vide → `throw error(403)`. Warning Better Auth `Base URL is not set` corrigé en parallèle (`baseURL` ajouté à la config).

**Décision :** Dans tout `+page.server.ts` enfant, récupérer le contexte tenant via `const { ludo, currentMember } = await parent()` (le `+layout.server.ts` les **retourne**) — crée une dépendance explicite, valeurs garanties. `locals.*` réservé aux **actions** (`requireContext`), qui s'exécutent hors de la course des `load`.

**Alternatives :** Peupler `locals.ludo` dans `hooks.server.ts` (slug pas fiablement dispo avant routing), garder la lecture `locals` synchrone (course non déterministe), helper re-résolvant le contexte depuis la session (DB call redondant avec le layout).

---

## 2026-06-16 | Contexte tenant des form actions via `requireLudoContext`, jamais `locals` (révise l'entrée précédente)

**Contexte :** Epic 05. Un membre soumettant une demande d'absence recevait un 403. Cause : `locals.ludo`/`locals.currentMember` ne sont posés que par le `load` du `[ludo]/+layout.server.ts`, et en SvelteKit les `load` **ne s'exécutent pas avant** une form action (ils tournent après, pour le re-render). Donc `locals.ludo` est `undefined` dans **toute** action — bug latent identique dans les actions de `membres` et `planning`, jamais déclenché jusque-là (membres issus du seed, planning WIP). Ceci corrige l'hypothèse de l'entrée précédente selon laquelle `locals.*` suffisait pour les actions.

**Décision :** Helper `src/lib/server/ludo-context.ts` — `requireLudoContext({ params, locals, cookies })` re-résout `ludo` + `member` depuis `params.ludo` + `locals.ludoSession` (même logique que le layout), `requireResponsableContext` ajoute la garde rôle. Utilisé dans **toutes** les form actions sous `[ludo]` ; le `+layout.server.ts` réutilise le même helper (DRY). Les `load` enfants gardent `await parent()`.

**Alternatives :** Lire `locals` dans les actions (le bug), peupler `locals` dans `hooks.server.ts` (DB call sur chaque requête, y compris assets), dupliquer la résolution dans chaque action (non DRY).
