# 18 — Documentation utilisateur (/aide)

Système de documentation utilisateur grand public (non-tech) avec captures d'écran auto-régénérées, servi comme guide dans l'app (`/aide`, URL globale). Produit par le skill réutilisable `user-docs` (`~/.claude/skills/user-docs/`, hors repo). Objectif : un manuel illustré consultable à tout moment par le staff des ludothèques.

## Etat session 2026-06-24 — Module Newsletter + fix prod ContactsTable

**Fait :**
- Module **Newsletter** livré (profondeur « essentiel ») → total **24 captures, 0 échec**. 4 shots : `contacts` (head-actions + segments), `campagnes` (bouton nouvelle), `editeur` (fullPage, form + aperçu email peint en live), `rapport` (spotlight cartes stats 6/0/1).
- Seed démo étendu : **9 contacts** public (segments famille×5/institution/partenaire + 1 désabonné + 1 rejeté), **1 brouillon** (`…0950`) + **1 campagne envoyée** (`…0951`) avec ses `campaign_sends` (6 livrés + 1 rejet → alimente le rapport). Les 3 tables newsletter sont en cascade `ludoId`/`campaignId` → **pas de purge à ajouter** au reset.
- **Bug de prod trouvé et corrigé** : `ContactsTable.svelte` ne passait qu'un état partiel (`{ sorting }`) à `createTable` → `@tanstack/table-core` lit `state.columnPinning.left` → **500 SSR dès qu'il y a ≥ 1 contact**. Jamais déclenché avant (aucun tenant testé n'avait de contacts). ⚠️ La page Contacts de **paquis-secheron** (113 contacts importés) est cassée en prod **jusqu'au prochain déploiement**.
- `pnpm check` vert (2217 fichiers, 0 erreur). Reseed + capture exécutés sur le serveur dev de Jonathan (port **5174** ce coup-ci).

**Prochain :** **Batch 3** = modules **Fréquentation** et **Paramètres** (même pattern : seed si besoin + section config + `content/[module].ts` + recapture, bump `docsVersion`). Puis penser à **déployer** pour réparer la page Contacts Pâquis-Sécheron en prod.

**Pièges :**
- Le serveur dev de Jonathan tourne sur le port qui change (5173 **ou** 5174). Vérifier avant capture (`Invoke-WebRequest`), puis `$env:DOCS_BASE_URL='http://localhost:5174'`. Là, 5173 servait un **autre projet** (« Bénévoles ACGB ») → bien viser le bon.
- L'éditeur de campagne `[id]/+page.svelte` **n'a pas de `<h1>`** (titre dans `<svelte:head>`) → `waitFor` sur `.preview-frame`, pas `h1`. Sinon le `waitFor: h1` matche le `<h1>500</h1>` de la page d'erreur et capture un **faux « ok »**.
- Erreurs SSR : le serveur renvoie « Internal Error » générique côté client (SvelteKit masque le détail) ; le vrai stack n'est que dans le terminal de Jonathan. Pour debug : `__data.json` (load seul) vs navigation (rend SSR) discrimine load vs rendu.

**Commit :** [e8a713d] feat(aide): module Newsletter dans la doc /aide

---

## Etat session 2026-06-24 — Batch 2 partiel (Réseau/Jeux/Matériel) + polish sommaire

**Fait :**
- Modules **Jeux**, **Matériel** et **Réseau** livrés (config + contenu + captures) → total **20 captures, 0 échec**. Réseau = 1 section, 3 étapes (aide / catalogue partagé / notifications).
- Seed démo étendu : **2e ludo figée `demo-voisine`** (rend les écrans cross-tenant réalistes côté `demo`), 2 thèmes partagés + 1 prêt actif (→ « Emprunté par vous »), demandes d'aide (ouverte voisine + ouverte demo avec volontaire + passée), `game_wishes`, `supply_requests`, `notifications` multi-domaines. **Reset rendu robuste multi-ludo** (purge `help_requests` → `theme_loans` → `theme_installations` avant les ludos : FK sans cascade).
- Polish `/aide` : sommaire en **accordéon** (n'ouvre que la section active, animé `transition:slide` + `prefers-reduced-motion`), **puces colorées** sur le corps des étapes (le Preflight Tailwind retirait les marqueurs `<ol>`), **gap gauche desktop** resserré (conteneur élargi + padding réduit, scopé à la page).
- `pnpm check` vert, ESLint 0. Captures vérifiées visuellement (annotations OK, données cross-tenant correctes).

**Prochain :** **Newsletter** (profondeur « essentiel » : Campagnes / éditeur / Contacts) — nécessite de seeder `campaigns` + `newsletter_contacts` dans `demo`, ajouter une section config + `content/newsletter.ts`, recapturer. Puis **Batch 3** = Fréquentation, Paramètres.

**Pièges :**
- Une **vraie** ludo (Pâquis-Sécheron) partage déjà un thème en prod → apparaît dans le catalogue réseau de `demo`. Sans incidence : « Château fort » (seed) sort premier (tri `asc(name)`), l'annotation reste juste.
- Reseed = `pnpm tsx scripts/seed-demo.ts` (écrit la DB Neon prod, tenants `demo` + `demo-voisine` seulement). Capture = `node scripts/capture-docs.mjs docs/user-docs.config.json` sur le serveur dev déjà lancé (souvent **5174** → `$env:DOCS_BASE_URL='http://localhost:5174'`).

**Commit :** [753b8fa] feat(aide): batch 2 partiel doc /aide — réseau, jeux, matériel + polish sommaire

---

## Etat session 2026-06-24 — Batch 1 + refonte GitBook + URL globale

**Fait :**
- Seed démo étendu : **Planning** (saison active « 2026 » + 12 samedis + assignations + fermeture vacances + `seasonMemberSettings`) et **Absences** (3 demandes : 1 en attente, 2 traitées), UUID/dates figés. Correctif d'un bug latent : `theme_installations.ludo_id` est sans cascade → le reset supprime les installations du demo AVANT la ludo.
- Modules **Démarrer, Planning, Absences** livrés (config + contenu + captures) → **13 captures, 0 échec**. Harness enrichi : shots `preAuth` (écrans de connexion avant login) + override `DOCS_BASE_URL`.
- Aide déplacée vers **URL globale `/aide`** (calquée sur `/reseau` : `requireSessionContext`, slug via session) ; ancienne `[ludo]/aide` supprimée ; lien nav repointé sur `/aide`.
- Refonte **type GitBook** : sommaire latéral + scroll-spy, recherche dans la doc, carte « démarrage rapide », images à droite du texte + zoom au survol + lightbox plein écran, typo soignée (numéros d'étape, gras `**`, listes à puces via `tips`, note « Bon à savoir » en card propre — sans bordure-gauche).
- `pnpm check` vert, ESLint 0, Prettier OK. Rendu validé (page + recherche + lightbox).

**Prochain :** Batch 2 = **Réseau, Jeux/Matériel, Newsletter** (même pattern : seed + section config + content + recapture), puis Batch 3 = **Fréquentation, Paramètres**. Régénérer : `pnpm tsx scripts/seed-demo.ts` puis `node scripts/capture-docs.mjs docs/user-docs.config.json`, et bumper `docsVersion`.

**Pièges :**
- Le serveur dev de Jonathan tourne parfois sur **5174** (fallback Vite), pas 5173 → utiliser `$env:DOCS_BASE_URL='http://localhost:5174'`. La config reste sur 5173 par défaut.
- Seul **`@playwright/test`** est installé (pas `playwright` bare). Le harness a un fallback ; un script Playwright ad hoc doit importer `@playwright/test` ET vivre dans le projet (résolution node_modules).
- Hero planning « prochain samedi » dépend du temps réel → seeder des samedis encadrant largement la date courante.

**Commit :** [7ed7b71] feat(aide): batch 1 (démarrer/planning/absences) + refonte /aide globale type guide

---

## Etat session 2026-06-24

**Fait :**
- Créé le skill réutilisable `user-docs` (hors repo) : noyau générique + adaptateur `docs/user-docs.config.json` par projet ; process 6 phases ; harness Playwright avec annotations (`highlights` encadrés rouges, `spotlight` zone claire/ombre, `clip` zoom) ciblées par sélecteur CSS ; cache-busting `docsVersion` ; heuristique d'annotation encodée.
- Spike + étalon sur le module **Thèmes** : seed tenant démo figé (`scripts/seed-demo.ts`), adaptateur (`docs/user-docs.config.json`), page `/[ludo]/aide` (`src/lib/aide/*` + route), 5 captures appliquant la convention orientation + zoom.
- Pipeline prouvé bout-en-bout (login multi-tenant scripté → capture → annotations sur le PNG → rendu /aide). `pnpm check` vert.

**Prochain :** Dérouler les **8 modules restants** (Démarrer, Planning, Absences, Réseau, Jeux/Matériel, Newsletter, Fréquentation, Paramètres) : pour chacun, enrichir `scripts/seed-demo.ts` + ajouter une section dans `docs/user-docs.config.json` (shots + annotations) + un fichier `src/lib/aide/content/[module].ts`, puis régénérer (`node scripts/capture-docs.mjs docs/user-docs.config.json`, bump `docsVersion`). Ajouter le lien « Aide » dans la nav du shell.

**Pièges :**
- IDs de routes = UUID `defaultRandom()` → le seed démo DOIT utiliser des UUID fixes, sinon routes non stables. Idem dates affichées → figées dans le seed (déterminisme captures).
- Harness importe `playwright` (bare specifier) → doit vivre dans le projet (`scripts/capture-docs.mjs`), pas dans `~/.claude`. Fallback `playwright` → `@playwright/test`.
- Captures statiques mises en cache par le navigateur → cache-busting `?v=docsVersion` obligatoire, bumper à chaque régénération.
- Capturer sur le serveur dev déjà lancé de Jonathan (`localhost:5173`) — ne jamais le démarrer.

**Commit :** [65c1806] feat(aide): page d'aide /aide avec captures auto-annotees (module Themes)

---

## Carte du code
> Mise a jour : 2026-06-24

| Fichier | Role |
|---------|------|
| `scripts/seed-demo.ts` | Seed tenants démo `demo` (+ `demo-voisine`) à UUID/dates figés : thèmes+installations, planning, absences, jeux, matériel, notifications, **newsletter (9 contacts + brouillon + campagne envoyée + sends)**, et côté voisine thèmes partagés + prêt + demandes d'aide. Reset robuste multi-ludo : `help_requests` → `theme_loans` → `theme_installations` → ludos (FK sans cascade) ; les tables newsletter partent en cascade `ludoId`/`campaignId`. |
| `scripts/capture-docs.mjs` | Harness Playwright : shots `preAuth` (avant login) + normaux, annotations highlights/spotlight/clip, override `DOCS_BASE_URL`, sortie `static/aide/captures/`. |
| `docs/user-docs.config.json` | Adaptateur : scénario d'auth + sections `demarrer`/`planning`/`absences`/`themes`/`jeux`/`materiel`/`reseau`/**`newsletter`** (shots + annotations). baseUrl 5173 par défaut. ⚠️ shot `editeur` = `waitFor` sur `.preview-frame` (pas de `<h1>` sur l'éditeur). |
| `src/lib/aide/types.ts` | Types `GuideSection`/`GuideStep` (`body` numéroté, `tips` puces, `note`). |
| `src/lib/aide/Rich.svelte` | Rendu du gras `**mot**` sans `@html` (découpage en segments). |
| `src/lib/aide/GuideSection.svelte` | Rendu d'un chapitre : étapes (corps à **puces colorées**) + tips + note (card), image cliquable avec zoom au survol (callback `onZoom`). |
| `src/lib/aide/content/index.ts` | Agrège les sections (ordre sommaire : `demarrer,planning,absences,themes,jeux,materiel,newsletter,reseau`) + `docsVersion` (cache-busting, actuel `2026-06-24-6`). |
| `src/lib/aide/content/{demarrer,planning,absences,themes,jeux,materiel,newsletter,reseau}.ts` | Contenu rédigé par module (gras + tips). |
| `src/routes/aide/+layout.server.ts` | `requireSessionContext` — aide globale, identité via session. |
| `src/routes/aide/+layout.svelte` | Monte `AppShell` + `--ludo-color`. |
| `src/routes/aide/+page.svelte` | Page type GitBook : sommaire latéral **en accordéon** (scroll-spy, `transition:slide`) + recherche + démarrage rapide + lightbox ; conteneur élargi (gap gauche resserré). |
| `src/lib/components/nav/nav-config.ts` | Lien « Aide » → `/aide` (global, hors slug). |
| `src/lib/components/newsletter/ContactsTable.svelte` | **Fix prod (1802b95)** : `createTable` doit recevoir `columnPinning` dans `state`, sinon `getHeaderGroups()` plante en SSR (500) dès qu'il y a des lignes. |
| `static/aide/captures/{…,newsletter}/*.png` | Captures versionnées (diffs visuels). |

### Decisions cles
- Aide = **route globale `/aide`** (pas par tenant) : une URL canonique, contenu + captures uniques, identité résolue via la session comme `/reseau/*`.
- Présentation **type guide GitBook** (sommaire accordéon + recherche + scroll-spy + lightbox), **tokens design uniquement**. Accordéon animé en natif Svelte (`transition:slide`, `MediaQuery` reduced-motion).
- Captures déterministes via tenants démo figés (UUID + dates). Les **écrans réseau** (cross-tenant) exigent une **2e ludo** `demo-voisine` car une ludo ne se voit pas elle-même dans le catalogue/feed. Shots `preAuth` pour les écrans hors session.
- Le skill `user-docs` vit hors repo ; seul l'adaptateur + le rendu vivent dans le projet.
- Distinct de `generate-docs` (docs techniques/API/livraison, sans captures).
