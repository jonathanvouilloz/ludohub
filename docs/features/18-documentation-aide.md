# 18 — Documentation utilisateur (/aide)

Système de documentation utilisateur grand public (non-tech) avec captures d'écran auto-régénérées, servi comme guide dans l'app (`/aide`, URL globale). Produit par le skill réutilisable `user-docs` (`~/.claude/skills/user-docs/`, hors repo). Objectif : un manuel illustré consultable à tout moment par le staff des ludothèques.

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
| `scripts/seed-demo.ts` | Seed tenant démo `demo` (mdp `demo2026`) à UUID/dates figés : thèmes+installations, planning (saison/samedis/assignations/fermeture/réglages), absences. Reset = delete installations PUIS ludo (FK `ludo_id` sans cascade). |
| `scripts/capture-docs.mjs` | Harness Playwright : shots `preAuth` (avant login) + normaux, annotations highlights/spotlight/clip, override `DOCS_BASE_URL`, sortie `static/aide/captures/`. |
| `docs/user-docs.config.json` | Adaptateur : scénario d'auth + sections `demarrer`/`planning`/`absences`/`themes` (shots + annotations). baseUrl 5173 par défaut. |
| `src/lib/aide/types.ts` | Types `GuideSection`/`GuideStep` (`body` numéroté, `tips` puces, `note`). |
| `src/lib/aide/Rich.svelte` | Rendu du gras `**mot**` sans `@html` (découpage en segments). |
| `src/lib/aide/GuideSection.svelte` | Rendu d'un chapitre : étapes numérotées + puces + note (card), image cliquable avec zoom au survol (callback `onZoom`). |
| `src/lib/aide/content/index.ts` | Agrège les sections (ordre sommaire) + `docsVersion` (cache-busting). |
| `src/lib/aide/content/{demarrer,planning,absences,themes}.ts` | Contenu rédigé par module (gras + tips). |
| `src/routes/aide/+layout.server.ts` | `requireSessionContext` — aide globale, identité via session. |
| `src/routes/aide/+layout.svelte` | Monte `AppShell` + `--ludo-color`. |
| `src/routes/aide/+page.svelte` | Page type GitBook : sommaire latéral + recherche + scroll-spy + démarrage rapide + lightbox. |
| `src/lib/components/nav/nav-config.ts` | Lien « Aide » → `/aide` (global, hors slug). |
| `static/aide/captures/{demarrer,planning,absences,themes}/*.png` | Captures versionnées (diffs visuels). |

### Decisions cles
- Aide = **route globale `/aide`** (pas par tenant) : une URL canonique, contenu + captures uniques, identité résolue via la session comme `/reseau/*`.
- Présentation **type guide GitBook** (sommaire + recherche + scroll-spy + lightbox), **tokens design uniquement**.
- Captures déterministes via tenant démo figé (UUID + dates). Shots `preAuth` pour les écrans hors session (connexion).
- Le skill `user-docs` vit hors repo ; seul l'adaptateur + le rendu vivent dans le projet.
- Distinct de `generate-docs` (docs techniques/API/livraison, sans captures).
