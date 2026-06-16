# Feature : NAVIGATION — Shell applicatif

**Epic :** 08 | **Taille :** M | **Statut :** TODO

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

- [ ] `NavItem.svelte` — item icône+label, état actif via `page.url.pathname` (`aria-current`)
- [ ] `AppSidebar.svelte` — sidebar desktop 72px (liste de NavItem + identité ludo en bas)
- [ ] `BottomTabBar.svelte` — tab bar mobile (onglets primaires + onglet « Plus »)
- [ ] `MoreSheet.svelte` — drawer mobile (liens secondaires, sélecteur/identité ludo, logout)
- [ ] `LudoBadge.svelte` — dot couleur `--ludo-color` + nom ludo + membre courant

### Layout (shell)

- [ ] `src/routes/[ludo]/+layout.svelte` — enveloppe les pages ludo avec le shell
- [ ] `src/routes/reseau/+layout.svelte` — même shell pour les routes cross-ludo (hors `[ludo]`)
  - Mutualiser via les composants `nav/*` ; ne pas dupliquer la logique
  - Réseau est cross-ludo → onglet « Réseau » actif sur `/reseau/*`
- [ ] Grille responsive : `[sidebar 72px | contenu]` ≥ `--bp-md`, `[contenu | tab bar]` en dessous

### Destinations de navigation

- [ ] Primaires : Accueil, Planning, Thèmes, Réseau (+ Absences) — icônes Lucide
- [ ] Secondaires (sheet « Plus » / bas de sidebar) : Équipe (responsable), Déconnexion
- [ ] Emplacement réservé pour le **badge Notifications** (epic 10) sur un item du shell

### Nettoyage

- [ ] Retirer les liens d'en-tête ad hoc devenus redondants : nav locale de
      `src/routes/[ludo]/+page.svelte`, liens en-tête de `themes/+page.svelte`,
      cross-links `reseau/themes` ↔ `reseau/aide` (remplacés par le shell)
- [ ] Conserver les `← retour` contextuels (fiche thème, etc.)

## Critères d'acceptation

- [ ] Sidebar 72px visible sur desktop, tab bar en bas sur mobile (bascule à `--bp-md`)
- [ ] Item actif correctement mis en évidence selon la route courante (`aria-current="page"`)
- [ ] Identité ludo (dot couleur + nom) + déconnexion accessibles depuis le shell
- [ ] Le shell couvre **et** les routes `[ludo]/*` **et** `reseau/*`
- [ ] Aucune valeur visuelle en dur — tokens uniquement (couleurs, durées, radius)
- [ ] Cibles tactiles ≥ 44px sur mobile ; navigation utilisable au clavier (focus visible)

## Edge cases

- Liens responsable (Équipe) masqués pour les membres simples (`isResponsable`)
- Route `reseau/*` : pas de slug dans l'URL → identité ludo résolue via la session
- Onglet « Plus » mobile : fermeture au tap extérieur / Échap

## Playwright tests

- [ ] Sidebar visible et navigation entre sections sur desktop
- [ ] Tab bar + sheet « Plus » fonctionnels sur viewport mobile
- [ ] Item actif reflète la section courante
