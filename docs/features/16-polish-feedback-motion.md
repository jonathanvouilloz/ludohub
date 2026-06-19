# Feature : POLISH — États, Feedback & Motion

**Epic :** 16 | **Taille :** M | **Statut :** DONE (code + vérif auto ; passe manuelle à faire)

## Etat session 2026-06-19 (implémentation)

**Fait :**

- **Phase 1** — `src/lib/utils/enhance.ts` → `toastEnhance()` : toast succès/erreur,
  pilotage pending (`onPending`), fermeture dialog (`onSuccess`), redirect, `errorMode`
  toast/inline, en conservant `await update()`. Convention serveur **inchangée** (aucun
  `+page.server.ts` touché — le message vit côté client).
- **Phase 2** — `ui/skeleton/` (`Skeleton`, `SkeletonCard`, `PageSkeleton`) + `ui/empty-state/`
  (`EmptyState`). Démos ajoutées au `/styleguide` (toasts, pending, skeleton, empty).
- **Phase 3** — ~38 composants/routes migrés `use:enhance` → `toastEnhance`. Toggles fréquents
  silencieux (`success:null`), forms de saisie longs en `errorMode:'inline'` (CheckupForm,
  LoginForm, MemberPicker, admin/login, MemberDialog, NewAbsenceDialog, CloseSessionDialog,
  AbsenceReviewDialog). Bannières `form?.error` redondantes retirées (anti-double-feedback).
- **Phase 4** — 17 fichiers : `<p class="empty">` → `EmptyState` (icônes lucide, `compact`,
  CTA en snippet `action`). Skeleton sur navigation client câblé dans `AppShell` via le store
  `navigating` pour les routes lourdes (themes, planning, frequentation, absences, réseau,
  notifs) — couvre aussi le rechargement en place (changement de saison fréquentation).
- **Phase 5** — Motion tokens only : `DataCard` élévation au survol (ombre+bordure, pas de
  translate car non cliquable) ; Dialog/AlertDialog/Select/Button `duration-100` → token
  `duration-[var(--dur-fast)]` (+ `ease-[var(--ease-out-strong)]` sur Button) → reduced-motion-aware.
- **Phase 6 (auto)** — `pnpm check` 0/0, **129 tests** OK, code epic lint-clean.

**Prochain :** Passe manuelle de Jonathan (une action par catégorie : création/suppression/erreur/
vide/navigation lourde + toggle OS `prefers-reduced-motion`). Puis enchaîner **12-TESTS E2E**.
**Pièges :**

- `use:enhance={toastEnhance(...)}` nécessite **toujours** l'import `enhance` de `$app/forms`
  EN PLUS de `toastEnhance` (la directive reste requise).
- 2 erreurs ESLint **préexistantes hors périmètre** (`slug` prop inutilisée dans
  `AbsenceCalendar.svelte`, import `clearAssignmentsBySeason` dans `services/planning.ts`) —
  présentes dans HEAD, non corrigées dans cet epic.
- Détail UX : pendant une nav entre onglets réseau (aide ↔ catalogue), le `PageSkeleton`
  remplace aussi la barre d'onglets brièvement (AppShell enveloppe tout). Affinable si gênant.

**Commit :** [0b96cf8] feat(polish): feedback toasts + skeleton/empty-state + motion tokens (epic 16)

---

## Etat session 2026-06-18 (cadrage)

**Fait :**

- Cadrage complet (cette spec) à partir du brainstorming Jonathan : lot transversal de
  finition UX. Aucune ligne de code.
- **Constat socle** (audit code réel) : l'essentiel de l'infra existe déjà, le lot est donc
  surtout du **câblage** + 2 composants manquants, pas de la construction :
  - `svelte-sonner` installé + `<Toaster />` monté dans `src/routes/+layout.svelte`, mais
    `toast()` n'est appelé **qu'à un seul endroit** (`ThemeImageGallery.svelte`).
  - `AlertDialog` réutilisable existe et est utilisé (games, supplies) — couverture à auditer.
  - `Spinner` existe ; pending géré ad-hoc via `let submitting = $state(false)`.
  - **Manquent** : `Skeleton`, `EmptyState`.
- Décision tranchée : **Motion se fait au niveau des composants `ui/`** (Button, Card,
  Dialog…) avec **tokens uniquement** → se propage partout, démo de validation sur le
  dashboard. Pas d'animation page par page.

**Prochain :** Phase 1 = helper `toastEnhance` + convention de retour des actions, puis câblage.
**Pièges :** `use:enhance` sans callback applique le retour par défaut — le remplacer par
`toastEnhance` doit **conserver** ce comportement (`await update()`). Règle design dure :
aucune couleur/durée/easing en dur, tokens `--dur-*` / `--ease-*` uniquement.
**Commit :** _(à venir)_ docs(polish): cadre epic 16 (états, feedback & motion)

---

## Objectif

Uniformiser le **feedback utilisateur** (succès, erreur, chargement, vide, confirmation) sur
toutes les surfaces de l'app, et poser une couche de **micro-interactions** au niveau des
composants réutilisables. Cible : staff peu technique → chaque action doit donner un retour
clair et immédiat.

## Portée

**Inclus :**

- Toasts succès/erreur sur **toutes les form actions** (matrice ci-dessous).
- Composants manquants : `Skeleton`, `EmptyState`.
- États de chargement standardisés (pending bouton, skeleton sur les listes au load).
- Audit + complétion des confirmations destructives (`AlertDialog` partout où il faut).
- Micro-interactions `ui/` (Button, Card/DataCard, Dialog/AlertDialog, Badge, nav) via tokens.

**Exclus (hors lot) :**

- Scénographie scroll / animations de site vitrine (non pertinent pour un dashboard).
- Refonte visuelle (déjà couverte par epic 14-DESIGN).
- Tests (epic 12 — mais les flows feedback seront vérifiables manuellement en fin de lot).

---

## Carte du code

> Mise à jour : 2026-06-19

| Fichier                                                | Role                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `src/lib/utils/enhance.ts`                             | **Cœur du lot.** `toastEnhance(opts)` : wrappe `enhance`, toast succès/erreur, `onPending`/`onSuccess`/`onError`, redirect, `await update()`. |
| `src/lib/components/ui/skeleton/{Skeleton,SkeletonCard,PageSkeleton}.svelte` | Shimmer tokens. `PageSkeleton` = placeholder de page lourde. |
| `src/lib/components/ui/empty-state/EmptyState.svelte`  | Icône lucide + titre + description + snippet `action` + variante `compact`. |
| `src/lib/components/nav/AppShell.svelte`               | Affiche `PageSkeleton` quand `navigating.to` cible une route lourde (`HEAVY_ROUTES`). |
| `src/lib/components/ui/data-card/DataCard.svelte`      | Élévation au survol (ombre + bordure, tokens). |
| `src/lib/components/ui/{dialog,alert-dialog,select}/*-content|*-overlay.svelte`, `ui/button/button.svelte` | Durée d'anim token-driven `duration-[var(--dur-fast)]` (reduced-motion-aware). |
| `src/lib/components/**` (forms) + `src/routes/**/+page.svelte` | `use:enhance` migrés vers `toastEnhance` ; `<p class="empty">` → `EmptyState`. |
| `src/routes/styleguide/+page.svelte`                   | Sections démo : Feedback (toasts/pending), Skeleton, Empty State. |

### Décisions clés (à respecter)

- **Message succès côté client.** Le wrapper serveur reste `{ success: true }` / `fail(400, { error })`
  — `toastEnhance({ success: '…' })` porte le libellé. Aucun `+page.server.ts` modifié.
- **Tri toast vs inline.** Quick action / dialog court → toast (défaut). Form de saisie long →
  `errorMode:'inline'` + `onError`. Toggles fréquents → `success:null` (silencieux).
- **`use:enhance={toastEnhance(...)}` garde l'import `enhance` de `$app/forms`** (directive).
- **Motion = tokens via classes arbitraires** (`duration-[var(--dur-fast)]`) → 0ms sous
  `prefers-reduced-motion` automatiquement.

- **Un seul point de câblage feedback : `toastEnhance`.** On ne réécrit pas la logique toast
  dans chaque composant. Le helper gère succès (`result.type === 'success'`), échec
  (`'failure'` → `result.data.error`), et redirections (`'redirect'` → toast optionnel via
  message passé en option, car le state client est perdu au redirect).
- **Convention de retour d'action.** Succès = `{ success: true, message?: string }` ;
  erreur = `fail(status, { error: '…' })`. `toastEnhance` a un message succès par défaut
  surchargeable par form (`toastEnhance({ success: 'Membre ajouté' })`).
- **Toggles silencieux possibles.** Les bascules optimistes très fréquentes (marquer lu,
  read/readAll, reopenSlot) peuvent rester sans toast pour ne pas spammer — décidé dans la matrice.
- **Motion = tokens only, niveau composant.** Aucune valeur en dur. `prefers-reduced-motion`
  déjà géré dans `tokens.css` (durées → 0ms) — ne pas le contourner.
- **Skeleton ≠ Spinner.** Skeleton pour le chargement initial d'une liste/page (perçu).
  Spinner pour une action en cours (bouton). Ne pas mélanger.

---

## Matrice des surfaces (tous les cas)

Légende feedback : **C** = confirmation `AlertDialog` requise · **T+** = toast succès ·
**T!** = toast erreur · **P** = pending bouton · **opt** = toast optionnel/silencieux.

### Mutations simples (T+ / T! / P)

| Page                              | Actions                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| `auth/[ludo]`                     | checkPassword, login (T! sur échec ; succès = redirect)        |
| `admin/login`                     | default (T! sur mauvais mot de passe)                          |
| `[ludo]/themes/new`               | create (T+ « Thème créé », redirect)                           |
| `reseau/themes`                   | request (T+ « Demande envoyée »)                               |
| `reseau/aide`                     | create (T+), respond (T+ « Inscrit »), confirm (T+ opt)        |
| `admin/(protected)/ludotheques`   | create (T+ « Ludothèque créée »)                               |
| `admin/(protected)/ludotheques/[id]` | update (T+), resetPassword (T+ « Mot de passe réinitialisé ») |
| `[ludo]/settings/membres`         | create (T+), update (T+), reactivate (T+ opt)                  |
| `[ludo]/settings/infos`           | update (T+ « Infos mises à jour »)                             |
| `[ludo]/games`                    | add (T+), markBought (T+ opt), markWanted (opt)                |
| `[ludo]/supplies`                 | create (T+), updateStatus (T+ opt)                             |
| `[ludo]/frequentation`            | record (T+ « Ouverture clôturée »), update (T+)               |
| `[ludo]/themes/[id]`              | update (T+), toggleShareable (opt), addItem (T+), loan (T+), returnLoan (T+), confirmRequest (T+), installTheme (T+) |
| `[ludo]/themes/[id]/installations/[iid]` | resolveItem (T+ opt)                                    |
| `…/installations/[iid]/checkup`   | recordCheckup (T+ « Check-up enregistré »), closeWithCheckup (T+) |
| `reseau/notifications`            | read (opt/silencieux), readAll (T+ « Tout marqué lu »)         |
| `[ludo]/planning` & `…/saisons/[id]` | assign (T+ opt), swap (T+), reopenSlot (opt), importFromGE (T+), createClosure (T+), saveMemberConfig (T+), addUnavailability (T+), generatePlanning (T+ « Planning généré ») |
| `[ludo]/planning/saisons`         | create (T+), activate (T+ opt)                                 |
| `[ludo]/absences`                 | request (T+), createForMember (T+), approve (T+), confirm (T+) |

### Actions destructives (C + T+ + T!)

| Page                              | Actions destructives                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `[ludo]/settings/membres`         | deactivate, delete                                            |
| `[ludo]/games`                    | delete *(C déjà en place — câbler T)*                         |
| `[ludo]/supplies`                 | delete *(C déjà en place — câbler T)*                         |
| `[ludo]/themes/[id]`              | removeItem, archive, declineRequest, delete                   |
| `[ludo]/planning`                 | remove, cancelSlot                                            |
| `[ludo]/planning/saisons`         | archive, delete                                               |
| `[ludo]/planning/saisons/[id]`    | remove, cancelSlot, deleteClosure                             |
| `[ludo]/absences`                 | cancel, deleteAbsence, refuse                                 |
| `[ludo]/frequentation`            | delete                                                        |

> **Audit confirmation** : vérifier que chaque action ci-dessus passe par un `AlertDialog`
> (pattern `WishlistItem.svelte` / `SupplyCard.svelte`). Compléter celles qui submit en direct.

### États vides (EmptyState)

Toutes les listes/tableaux : games, supplies, absences, planning (slots), themes (catalogue +
réseau), frequentation (mois sans ouverture), notifications, membres inactifs, logs admin,
demandes d'aide réseau. → remplacer les `{#if items.length === 0}<p>…</p>` par `<EmptyState>`.

### États de chargement (Skeleton)

Listes chargées au `load` (pas instantanées) : catalogue thèmes (+ images), planning saison,
frequentation, logs admin, notifications. → `Skeleton` pendant `navigating` / au premier rendu.

---

## Phases

### Phase 1 — Socle feedback

- [x] Créer `src/lib/utils/enhance.ts` → `toastEnhance(opts)` (succès/erreur/redirect, `update()`).
- [x] Convention de retour conservée côté serveur ; message porté côté client par `toastEnhance`.
- [x] Démo dans `/styleguide` : boutons pending, toasts succès/erreur.

### Phase 2 — Composants manquants

- [x] `ui/skeleton/` (`Skeleton`, `SkeletonCard`, `PageSkeleton`) — shimmer via tokens.
- [x] `ui/empty-state/EmptyState.svelte` (+ exports index) — icône/titre/desc/action/compact.
- [x] Démo `/styleguide` pour les deux.

### Phase 3 — Câblage feedback (par domaine)

- [x] Auth + Admin (login, ludothèques CRUD, reset password).
- [x] Settings (membres, infos).
- [x] Games + Supplies.
- [x] Thèmes (fiche, items, prêts, installations, check-ups) + Réseau (aide, thèmes, notifs).
- [x] Planning (saisons, slots, génération, clôtures) + Absences.
- [x] Fréquentation.
- [x] Audit confirmations destructives (les `AlertDialog` existants câblés en toast).

### Phase 4 — États vides & chargement

- [x] Remplacer les listes vides ad-hoc par `EmptyState` (17 fichiers).
- [x] `PageSkeleton` sur navigation client vers routes lourdes (via `navigating` dans `AppShell`).

### Phase 5 — Motion (niveau ui/, tokens only)

- [x] Button : transition token-driven `duration-[var(--dur-fast)]` + `ease-[var(--ease-out-strong)]`.
- [x] DataCard : élévation au survol (ombre + bordure, tokens ; pas de translate car non cliquable).
- [x] Dialog / AlertDialog / Select : durées en dur → token `--dur-fast` (reduced-motion-aware).
- [x] Nav items : transitions déjà en place (tokens).

### Phase 6 — Vérif

- [x] `pnpm check` (0/0) + lint epic propre + 129 tests OK.
- [ ] Passe manuelle : une action de chaque catégorie (création, suppression, erreur, vide, load).
- [ ] `prefers-reduced-motion` : durées à 0, aucune anim résiduelle.
