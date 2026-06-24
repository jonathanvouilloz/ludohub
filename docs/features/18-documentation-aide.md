# 18 — Documentation utilisateur (/aide)

Système de documentation utilisateur grand public (non-tech) avec captures d'écran auto-régénérées, servi comme page d'aide dans l'app (`/[ludo]/aide`). Produit par le skill réutilisable `user-docs` (`~/.claude/skills/user-docs/`, hors repo). Objectif : un manuel illustré consultable à tout moment par le staff des ludothèques.

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
| `scripts/seed-demo.ts` | Seed du tenant démo `demo` (slug `demo`, mdp `demo2026`) à UUID + dates figés ; idempotent (delete cascade par slug puis recrée). |
| `scripts/capture-docs.mjs` | Harness Playwright piloté par la config : login scripté, navigation, annotations (highlights/spotlight/clip), capture vers `static/aide/captures/`. |
| `docs/user-docs.config.json` | Adaptateur LudoHub : baseUrl, scénario d'auth, sections/shots + annotations. Pour l'instant section Thèmes (5 shots). |
| `src/lib/aide/types.ts` | Types `GuideSection` / `GuideStep`. |
| `src/lib/aide/GuideSection.svelte` | Rendu d'une section (titre, étapes numérotées, capture `?v=`, encadré « Bon à savoir »). Tokens design. |
| `src/lib/aide/content/index.ts` | Agrège les sections + `docsVersion` (cache-busting). |
| `src/lib/aide/content/themes.ts` | Contenu rédigé du module Thèmes (5 étapes). |
| `src/routes/[ludo]/aide/+page.svelte` | Route `/aide` (noindex, dans le shell) : en-tête + sommaire + sections. |
| `static/aide/captures/themes/*.png` | Les 5 captures Thèmes (versionnées en git pour les diffs visuels). |

### Decisions cles
- Le skill `user-docs` vit hors repo (`~/.claude/skills/user-docs/`) ; seul l'adaptateur + le rendu vivent dans le projet. Les routes `src/routes/` servent de sommaire.
- Captures déterministes via tenant démo seedé (UUID + dates figés), pas via une vraie ludo.
- Annotations dessinées sur le PNG (pas un calque HTML), ciblées par sélecteur CSS → robustes au changement d'UI. Convention : spotlight = où c'est / clip = détail / highlights = plusieurs éléments ; pattern non-tech = écran annoté + zoom.
- Distinct de `generate-docs` (qui reste pour docs techniques/API/livraison et interdit les captures).
