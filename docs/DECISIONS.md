# Décisions techniques — LudoHub

Format : `Date | Décision | Contexte | Alternatives considérées`

---

## 2026-06-18 | DatePicker : prop `minValue` pour les couples début/fin

**Contexte :** Sur les double date pickers, le picker de fin rouvrait sur le mois courant (pas sur la date de début) et n'empêchait pas une date de fin antérieure au début.

**Décision :** Ajouter une prop `minValue?: string` au composant `DatePicker` partagé : bits-ui désactive nativement les jours antérieurs (`minValue` sur `Calendar.Root`), `bind:placeholder` aligne le mois d'ouverture sur la borne min, et un effet efface la valeur si elle passe sous la borne. Le picker de fin reçoit `minValue={dateDébut}` sur les 4 couples.

**Alternatives :** Validation uniquement côté serveur (rejeté : mauvaise UX, renavigation manuelle) ; logique dupliquée par dialog (rejeté : centraliser dans le composant partagé).

---

## 2026-06-18 | Saison active explicite (`is_active`) plutôt qu'implicite (plus récente non-archivée)

**Contexte :** L'ancien système rendait active la saison la plus récente non-archivée, ce qui empêchait de préparer une future saison en avance. Besoin d'un contrôle explicite avec 3 états : Active / En préparation / Archivée.

**Décision :** Colonne `is_active boolean default false` sur `seasons`. `activateSeason` archive atomiquement l'ancienne via `db.batch()`. Une seule active par ludo, gérée en service (pas de contrainte DB unique — neon-http sans transaction interactive).

**Alternatives :** Contrainte UNIQUE partielle en DB (rejetée : neon-http `db.batch()` suffit + plus simple) ; garder l'implicite + flag "draft" séparé (rejeté : 2 colonnes pour la même sémantique).

---

## 2026-06-18 | Import ge.ch : attribut `title=` du `<a>` plutôt que contenu textuel

**Contexte :** Le contenu texte de `<a href="*/telecharger">` contient un `<span class="material-icons-outlined">` imbriqué, ce qui casse le regex `[^<]+` (s'arrête au premier `<`). L'attribut `title="lundi 19 octobre 2026 au..."` contient le texte propre sans HTML.

**Décision :** Cibler `/<a\s[^>]*href="[^"]*\/telecharger"[^>]*>/gi` et extraire `title="..."` pour le texte de date. Chercher en arrière le `<strong>` le plus proche pour le label.

**Alternatives :** Strip HTML complet puis parse texte brut (plus fragile), LLM Mistral (dépendance externe inutile pour un format aussi régulier).

---

## 2026-06-17 | Système de composants UI : on étend les primitives `ui/` plutôt que des wrappers ad hoc

**Contexte :** Palette très claire → boutons `ghost`/`outline` et badges `outline` invisibles ; tableaux transparents et non responsive ; cartes dupliquées entre matériel et jeux. Besoin d'une base réutilisable et d'une charte respectée pour toute modif future.

**Décision :** Centraliser dans `src/lib/components/ui/` : (1) variantes de `button`/`badge` revues (bordure forte sur boutons texte, icône-only sans bordure via `compoundVariants`, variantes `success`/`warning`, `StatusBadge`) ; (2) nouveaux composants `data-table` (responsive → cartes < 640px), `data-card` (carte unifiée, les cartes domaine en deviennent des adaptateurs), `collapsible-section`. Conventions figées dans `DESIGN.md §9` / `STYLEGUIDE.md`.

**Alternatives :** Wrappers par domaine sans toucher `ui/` (rejeté : duplication, dérive de la charte) ; garder shadcn par défaut (rejeté : invisibilité des boutons sur la palette claire).

---

## 2026-06-17 | Tailwind v4 `@theme` : valeurs littérales pour radius/ombres (pas d'auto-référence)

**Contexte :** `@theme` mappait `--radius-lg: var(--radius-lg)` (même nom des deux côtés) → résolution cassée, `border-radius` à 0 sur les boutons/surfaces. Le pattern marche pour les couleurs car les noms diffèrent (`--color-primary: var(--primary)`).

**Décision :** Poser les valeurs littérales dans `@theme` (`--radius-lg: 16px`, ombres idem). `tokens.css` reste la source documentaire ; `@theme` est l'override Tailwind.

**Alternatives :** Renommer les tokens source (rejeté : utilisés en `var()` dans tout le CSS scopé) ; supprimer le mapping (rejeté : Tailwind retomberait sur ses défauts 0.5rem).

---

## 2026-06-17 | Notifs check-up : deep-link vers la liste thèmes (pas l'installation précise)

**Contexte :** La table `notifications` ne stocke pas de `metadata` (seul `activity_log` l'a). Les 4 nouveaux types de notif liés aux installations (`theme_installed`, `installation_closed`, `checkup_recorded`, `checkup_missing_item`) n'ont donc pas accès au `themeId` pour construire l'URL `/[slug]/themes/[themeId]/installations/[iid]`.

**Décision :** Faire pointer ces notifs vers la liste `/[slug]/themes` (domaine `themes`). Suffisant pour le MVP : la notif actionnable (`checkup_missing_item`) attire l'attention, l'utilisateur navigue ensuite.

**Alternatives :** Ajouter une colonne `metadata jsonb` à `notifications` (rejeté pour l'instant : surdimensionné pour un seul cas) ; stocker `entityId = themeId` au lieu de `installationId` (rejeté : casse la cohérence `entityType=installation`).

---

## 2026-06-17 | Thèmes : séparer « contenu complet » (référence) et « installé » (sous-ensemble contrôlé)

**Contexte :** `theme_items` était une liste plate. Or un thème complet vit dans une caisse ; à chaque animation on n'en sort qu'un sous-ensemble (~70-80 %), et seul ce sous-ensemble fait l'objet de check-ups quotidiens. Fonctionnalité présente sur samediLudoV2, jamais portée. (Spec : epic 13.)

**Décision :** Garder `theme_items` comme liste de référence (jamais modifiée à l'install). Ajouter `theme_installations` (événement daté, sous-ensemble sorti, statut `en_cours`/`cloturee`, une seule active par thème) + `theme_installation_items`, puis `theme_checkups` + `theme_checkup_items` (statut `present`/`manquant`, quantité affichée dans le label, pas en input). Notif si ≥1 item manquant (`emitEvent`). Install autorisée au propriétaire OU à l'emprunteur d'un prêt actif. Pas de contrôle de fréquence.

**Alternatives :** Quantité partielle par item (rejeté : trop lourd au quotidien) ; installation comme état booléen sur l'item sans historique (rejeté : perd la traçabilité datée) ; check-up libre sans rattachement à une installation (rejeté : pas de base de comparaison).

---

## 2026-06-17 | Session super-admin = cookie signé distinct + groupe de routes `(protected)`

**Contexte :** L'epic 11 protège `/admin` par `SUPER_ADMIN_PASSWORD`, séparé des sessions ludo. Il faut une page de login publique sans créer de boucle de redirection avec la garde.

**Décision :** Cookie signé dédié `ludohub_admin` (calque de `auth.ts`, signé `BETTER_AUTH_SECRET`, 7 j), lu par `hooks.server.ts` uniquement sous `/admin`. La garde vit dans un groupe de routes SvelteKit `(protected)` ; `/admin/login` reste hors groupe donc public. Les groupes `(…)` n'affectent pas l'URL. Slug de ludo non éditable après création (URLs/sessions en dépendent).

**Alternatives :** Better Auth pour l'admin (machinerie superflue), garde par test de `pathname` dans un layout `/admin` unique (fragile), HTTP Basic Auth (UX pauvre, pas de logout propre).

---

## 2026-06-15 | Auth par mot de passe partagé par ludo (Better Auth)

**Contexte :** Les ludothèques ont un staff peu technique. Créer un compte individuel par membre crée de la friction et des mots de passe oubliés. Le modèle existant (`samediLudoV2`) utilisait localStorage — non sécurisé et non scalable.

**Décision :** Un mot de passe unique par ludo (haché bcrypt). L'utilisateur saisit le mot de passe commun, puis choisit son nom dans la liste des membres actifs. Session cookie httpOnly 30 jours.

**Alternatives :** Auth individuelle email/password (trop de friction), magic link (complexité infra email), SSO FASE (dépendance externe non garantie).

---

## 2026-06-16 | Notifications ≠ activity_log, point d'émission unifié (dispatcher)

**Contexte :** L'epic 10 ajoute des notifs in-app. Les notifications (par destinataire, lu/non-lu, fan-out 1→N, souvent une autre ludo) et l'audit `activity_log` (super-admin, append-only, ludo acteur) sont deux préoccupations distinctes.

**Décision :** Tables séparées, mais **point d'émission unique** : les services appellent `emitEvent` (`services/events.ts`) une fois ; le dispatcher écrit la ligne d'audit **et** les notifications par destinataire. Dispatch best-effort (try/catch — ne fait jamais échouer l'action métier), idempotent, jamais d'auto-notif de l'acteur.

**Alternatives :** Fusionner les deux tables (sémantiques incompatibles : cardinalité, audience, cycle de vie), ou émettre séparément dans chaque service (duplication + risque d'oubli).

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

---

## 2026-06-16 | Thèmes : prêts push-only en 06, contexte session pour `/reseau`, gotcha CSS Tailwind v4

**Contexte :** Epic 06-THÈMES. Le doc feature décrivait aussi un flow pull/request (`requestTheme` → `en_attente` → `confirmLoanRequest`), mais l'enum `loan_status` ne contient que `actif/retourne/annule`. Les routes catalogue réseau vivent sous `/reseau/*` (hors `[ludo]`), sans slug pour `requireLudoContext`. Bug UI : les `Button` rendus en `<a href>` avaient un texte invisible + souligné.

**Décision :** (1) **Prêts push uniquement** en 06 (propriétaire prête → `actif`, puis retour) ; le flow pull/request est reporté à 07-RÉSEAU → enum laissé inchangé, pas de `db:push`. (2) **Tous les membres actifs** gèrent les thèmes (actions via `requireLudoContext`, pas responsable). (3) Helper `requireSessionContext` (résout `ludo`+`member` depuis la seule session) pour `/reseau/*` et l'endpoint d'upload. (4) En Tailwind v4 les règles CSS **hors `@layer`** priment sur les utilitaires : `a {}` global dans `app.css` écrasait `text-primary-foreground` des boutons-liens → scopé en `a:not([data-slot='button'])`. Input partagé passé `bg-transparent`→`bg-card`.

**Alternatives :** Ajouter `en_attente` à l'enum dès 06 (scope élargi prématurément), réutiliser `requireLudoContext` avec un slug factice pour `/reseau` (bancal), déplacer les règles `a` dans `@layer base` (corrige la précédence mais touche tous les liens), corriger l'input localement page par page (non DRY).

---

## 2026-06-16 | RÉSEAU : flow pull via `en_attente`, garde « ouvrant », confirmation par tout membre actif

**Contexte :** Epic 07-RÉSEAU. Réalisation du flow pull/request reporté de 06 (enum `loan_status` à étendre) + des demandes d'aide cross-ludo. Question de qui confirme côté ludo demandeuse, et de comment empêcher un thème déjà réservé d'être re-prêté.

**Décision :** (1) `loan_status` += `en_attente` (`db:push`) : un pull crée un prêt `en_attente` que le **propriétaire** confirme → `actif`. (2) `getOpenLoanForTheme` (statut `actif|en_attente`) bloque **et** un nouveau push **et** un nouveau pull tant qu'un prêt est ouvert ; demandes en attente exclues de l'historique des prêts (section dédiée sur la fiche). (3) Confirmation/annulation d'une demande d'aide = **tout membre actif** de la ludo demandeuse (cohérent avec la gestion des thèmes, pas de gating responsable) ; à la confirmation d'un volontaire, les **autres réponses passent `refuse`** automatiquement. (4) États « en attente » thémisés via tokens `--warning`/`--warning-light` (le variant `outline` paraissait transparent).

**Alternatives :** Confirmation responsable-only (incohérent avec les thèmes), garde sur le seul statut `actif` (laisserait deux demandes ouvrir en parallèle), laisser les réponses non confirmées en `propose` (feed ambigu), badge outline par défaut (illisible sur carte).

---

## 2026-06-16 | Notifications ≠ activity_log : tables distinctes, point d'émission unifié (planif epic 10)

**Contexte :** Discussion post-07 sur un système de notifications. `activity_log` existe au schéma mais n'est écrit nulle part (réservé à 11-ADMIN). Tentation de tout y mettre. Par ailleurs, constat que la **navigation** (sidebar spécifiée au PRD/DESIGN) n'a jamais été construite — aucun epic ne l'a prise en charge.

**Décision :** Deux nouveaux epics planifiés (numéro = ordre) : **08-NAVIGATION** (shell : sidebar 72px desktop + bottom tab bar mobile) puis **10-NOTIFICATIONS**. On **ne fusionne pas** `notifications` et `activity_log` (audiences, cycle lu/non-lu, cible destinataire ≠ acteur, fan-out 1→N différents) — on **unifie le point d'émission** : un dispatcher (`events.ts`) écrit la ligne d'audit **et** les notifications par destinataire. `type` (domaine) + `severity` (`info`/`action_required`, ce dernier alimente le badge). Roadmap renumérotée : wishlist 08→09, admin 09→11, tests →12.

**Alternatives :** Greffer état lu/non-lu + destinataire sur `activity_log` (pollue le journal d'audit), notifications sans table (badges calculés au load — pas d'historique lu/non-lu), push web/email (hors stack ; éventuel via Brevo plus tard).

---

## 2026-06-16 | NAVIGATION : shell mutualisé piloté par une config de destinations à zones

**Contexte :** Epic 08-NAVIGATION. La sidebar (72px desktop) + bottom tab bar mobile devaient envelopper **et** `[ludo]/*` **et** `reseau/*` sans dupliquer la liste des liens entre sidebar / tab bar / sheet « Plus ». Pas de composant Sheet/Drawer dans `ui/`, pas de route logout. Les tokens `--bp-*` ne sont pas utilisables dans une condition `@media` (limite CSS).

**Décision :** Source unique `nav-config.ts` — chaque destination porte un tableau `zones` (`sidebar`/`tabbar`/`sheet`) + un matcher d'état actif + `responsableOnly` ; sidebar, tab bar et sheet filtrent la même liste. Shell rendu identiquement pour les deux scopes car les deux `+layout.server.ts` exposent `ludo` + `currentMember`. Sheet « Plus » montée en permanence + transition CSS `--ease-drawer` (pas de transition JS) → respecte `prefers-reduced-motion` via la neutralisation des durées dans `tokens.css`. Breakpoint `768px` **en dur** dans les `@media`. Route `POST /auth/logout` (slug résolu serveur depuis la session → redirect `/auth/{slug}`). Tab bar mobile = Accueil · Planning · Thèmes · Réseau · Plus (Absences/Équipe en sheet). Wrapper `.nav-item__icon` réservé au futur badge notifs (epic 10).

**Alternatives :** Deux shells séparés (`[ludo]` vs `reseau`, duplication), trois listes de liens distinctes (désync), transition JS Svelte (`fly`) pour la sheet (durée hardcodée + reduced-motion non respecté), composant Drawer shadcn (dépendance bits-ui non installée), logout en form action par scope (slug à passer + duplication).
