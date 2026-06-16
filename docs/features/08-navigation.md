# Feature : NAVIGATION — Shell applicatif

**Epic :** 08 | **Taille :** M | **Statut :** DONE

## Etat session 2026-06-16

**Fait :**
- Shell partagé `src/lib/components/nav/` : 7 composants (`nav-config.ts`, `NavItem`, `LudoBadge`, `AppSidebar`, `BottomTabBar`, `MoreSheet`, `AppShell`). Source unique des destinations avec zones (sidebar/tabbar/sheet) + matchers d'état actif + `responsableOnly`.
- Sidebar 72px desktop (masquée < 768px) ↔ bottom tab bar mobile (Accueil · Planning · Thèmes · Réseau · Plus, masquée ≥ 768px) + sheet « Plus » (drawer CSS `--ease-drawer`, Échap / clic overlay / `afterNavigate`, focus à l'ouverture).
- Layouts branchés : `[ludo]/+layout.svelte` enveloppé dans `AppShell` ; nouveau `reseau/+layout.svelte` (même shell, `--ludo-color` via session).
- Nouvelle route `POST /auth/logout` (slug résolu serveur → redirect `/auth/{slug}`).
- Nettoyage des liens ad hoc (accueil, en-tête thèmes, cross-links réseau) + styles orphelins. `← retour` contextuels conservés. Validé visuellement par Jonathan.

**Prochain :** Epic 09-WISHLIST + MATÉRIEL (listes internes simples). Les 3 tests Playwright du shell sont reportés à l'epic 12-TESTS E2E.
**Pieges :** Les `--bp-*` ne sont pas utilisables dans une condition `@media` (limite CSS) → breakpoint en dur `768px` (= `--bp-md`). Sheet montée en permanence (transition CSS) pour respecter `prefers-reduced-motion` automatiquement.
**Commit :** _(à venir ce wrap)_

---

## Carte du code
> Mise a jour : 2026-06-16

| Fichier | Role |
|---------|------|
| `src/lib/components/nav/nav-config.ts` | Source unique des destinations (label, href, icône, matcher actif, zones, responsableOnly) |
| `src/lib/components/nav/NavItem.svelte` | Item icône+label, actif via `page.url.pathname` + `aria-current` ; layouts stack/row |
| `src/lib/components/nav/LudoBadge.svelte` | Dot `--ludo-color` + nom ludo + membre (mode compact sidebar) |
| `src/lib/components/nav/AppSidebar.svelte` | Sidebar desktop 72px (nav + badge + déconnexion), masquée < 768px |
| `src/lib/components/nav/BottomTabBar.svelte` | Tab bar fixe mobile (4 primaires + « Plus »), masquée ≥ 768px |
| `src/lib/components/nav/MoreSheet.svelte` | Drawer bas mobile (Absences, Équipe, identité, logout) ; transition CSS `--ease-drawer` |
| `src/lib/components/nav/AppShell.svelte` | Orchestrateur : grille responsive + état d'ouverture de la sheet |
| `src/routes/[ludo]/+layout.svelte` | Enveloppe les pages ludo dans `AppShell` |
| `src/routes/reseau/+layout.svelte` | Même shell pour les routes cross-ludo (identité via session) |
| `src/routes/auth/logout/+server.ts` | `POST` déconnexion : `clearLudoSession` + redirect `/auth/{slug}` |

### Decisions cles
- Destinations centralisées dans `nav-config.ts` avec un tableau de `zones` → la sidebar, la tab bar et la sheet filtrent la même source, zéro duplication.
- Shell rendu identiquement pour `[ludo]/*` et `reseau/*` car les deux `+layout.server.ts` exposent `ludo` + `currentMember`.
- Breakpoint `768px` en dur dans les `@media` (les tokens `--bp-*` ne sont pas utilisables en condition media).
- Sheet montée en permanence + transition CSS (pas de transition JS) → respecte `prefers-reduced-motion` via la neutralisation des durées dans `tokens.css`.

## Contexte

Le PRD et le DESIGN spécifiaient déjà la navigation (sidebar verticale 72px icônes +
labels 12px, états `nav item` sur `/styleguide#nav`, token `--ease-drawer` pour un drawer
mobile) mais **aucun epic ne l'a construite** : 01-SETUP a posé le socle technique, pas le
shell visuel, et chaque epic feature a livré sa page avec des liens d'en-tête ad hoc. Cette
feature comble ce trou : un **shell partagé** qui enveloppe toutes les sections.

Usage cible **~50/50 mobile/desktop** → responsive de première classe, pas une adaptation.

## Décisions de cadrage (validées)

- **Desktop** : sidebar verticale étroite **72px**, icônes Lucide 24px + label 12px, état
  actif/hover (réf. `/styleguide#nav`, palette `--primary` / `--primary-light`).
- **Mobile** : **bottom tab bar** (zone du pouce), 4–5 onglets icône+label, onglet « Plus »
  ouvrant une sheet/drawer (`--ease-drawer`) pour le reste + identité ludo + déconnexion.
- La navigation **ne s'anime jamais** (règle Motion du DESIGN) ; seul le drawer mobile anime.

## Tâches

### Composants (`src/lib/components/nav/`)

- [x] `NavItem.svelte` — item icône+label, état actif via `page.url.pathname` (`aria-current`)
- [x] `AppSidebar.svelte` — sidebar desktop 72px (liste de NavItem + identité ludo en bas)
- [x] `BottomTabBar.svelte` — tab bar mobile (onglets primaires + onglet « Plus »)
- [x] `MoreSheet.svelte` — drawer mobile (liens secondaires, sélecteur/identité ludo, logout)
- [x] `LudoBadge.svelte` — dot couleur `--ludo-color` + nom ludo + membre courant
- [x] `nav-config.ts` — source unique des destinations (zones sidebar/tabbar/sheet)
- [x] `AppShell.svelte` — orchestrateur grille responsive + état sheet

### Layout (shell)

- [x] `src/routes/[ludo]/+layout.svelte` — enveloppe les pages ludo avec le shell
- [x] `src/routes/reseau/+layout.svelte` — même shell pour les routes cross-ludo (hors `[ludo]`)
  - Mutualiser via les composants `nav/*` ; ne pas dupliquer la logique
  - Réseau est cross-ludo → onglet « Réseau » actif sur `/reseau/*`
- [x] Grille responsive : `[sidebar 72px | contenu]` ≥ `--bp-md`, `[contenu | tab bar]` en dessous

### Destinations de navigation

- [x] Primaires : Accueil, Planning, Thèmes, Réseau (+ Absences) — icônes Lucide
      (tab bar mobile : Accueil · Planning · Thèmes · Réseau · Plus ; Absences en sheet)
- [x] Secondaires (sheet « Plus » / bas de sidebar) : Équipe (responsable), Déconnexion
- [x] Emplacement réservé pour le **badge Notifications** (epic 10) : wrapper `.nav-item__icon`

### Nettoyage

- [x] Retirer les liens d'en-tête ad hoc devenus redondants : nav locale de
      `src/routes/[ludo]/+page.svelte`, liens en-tête de `themes/+page.svelte`,
      cross-links `reseau/themes` ↔ `reseau/aide` (remplacés par le shell)
- [x] Conserver les `← retour` contextuels (fiche thème, etc.)

## Critères d'acceptation

- [x] Sidebar 72px visible sur desktop, tab bar en bas sur mobile (bascule à `--bp-md`)
- [x] Item actif correctement mis en évidence selon la route courante (`aria-current="page"`)
- [x] Identité ludo (dot couleur + nom) + déconnexion accessibles depuis le shell
- [x] Le shell couvre **et** les routes `[ludo]/*` **et** `reseau/*`
- [x] Aucune valeur visuelle en dur — tokens uniquement (couleurs, durées, radius)
- [x] Cibles tactiles ≥ 44px sur mobile ; navigation utilisable au clavier (focus visible)

## Edge cases

- Liens responsable (Équipe) masqués pour les membres simples (`isResponsable`)
- Route `reseau/*` : pas de slug dans l'URL → identité ludo résolue via la session
- Onglet « Plus » mobile : fermeture au tap extérieur / Échap

## Playwright tests

> Reportés à l'epic **12-TESTS E2E** (consolidation transversale des flows critiques).

- [ ] Sidebar visible et navigation entre sections sur desktop
- [ ] Tab bar + sheet « Plus » fonctionnels sur viewport mobile
- [ ] Item actif reflète la section courante
