# DESIGN — LudoHub

## 1. Essence

LudoHub est l'outil de travail quotidien du staff des ludothèques genevoises — des gens qui travaillent avec des enfants, des jeux, de la chaleur humaine. L'interface doit communiquer **clarté opérationnelle et bienveillance** : on sait où on est, ce qu'on doit faire, sans devoir deviner.

La référence directe est **Tipee** (l'outil RH que les ludos utilisent via la FASE) — même DNA fonctionnel, même densité d'information — mais traduit avec une palette plus douce et des bords plus arrondis qui rappellent l'univers du jeu.

**Anti-essence :** jamais froid / corporate / administratif lourd. Jamais un dashboard SaaS générique aux tons gris acier. Jamais d'animations spectaculaires qui distraient du travail.

---

## 2. Voix & ton

L'interface parle français, simplement. Pas de jargon informatique.

- **Boutons d'action principale :** verbe clair à l'infinitif — "Ajouter un membre", "Soumettre la demande", "Prêter ce thème"
- **Boutons destructifs :** "Désactiver" (jamais "Delete"), "Supprimer" avec confirmation obligatoire
- **États vides :** phrase explicative + action — "Aucun membre actif. Ajoutez le premier membre de votre équipe."
- **Erreurs :** directes sans jargon — "Mot de passe incorrect." (pas "Authentication failed")
- **Confirmations :** rassurantes — "Demande envoyée" (pas "Success" en anglais)

---

## 3. Couleurs

### Core

| Token             | Valeur    | Usage                                         |
| ----------------- | --------- | --------------------------------------------- |
| `--primary`       | `#0073E6` | Navigation active, liens, actions secondaires |
| `--primary-dark`  | `#005BA8` | Hover bouton primary, état actif              |
| `--primary-light` | `#E8F2FE` | Background hover nav, pills légères           |
| `--accent`        | `#C0007A` | CTA principal (bouton primaire, FAB)          |
| `--accent-dark`   | `#9A0062` | Hover/focus accent                            |
| `--accent-light`  | `#FDE8F4` | Background badge accent                       |

### Surfaces & lignes

| Token             | Valeur    | Usage                          |
| ----------------- | --------- | ------------------------------ |
| `--bg-base`       | `#EEF2F8` | Fond général (gris bleuté)     |
| `--bg-card`       | `#FFFFFF` | Cartes, modales, dropdowns     |
| `--bg-sidebar`    | `#F1F5FA` | Sidebar                        |
| `--bg-hover`      | `#F5F8FC` | Hover sur items de liste       |
| `--border`        | `#DDE3EE` | Séparateurs, bordures de cards |
| `--border-strong` | `#C4CDD9` | Inputs, borders actives        |

### Ink (texte)

| Token            | Valeur    | Usage                           |
| ---------------- | --------- | ------------------------------- |
| `--text-main`    | `#25324B` | Corps de texte principal        |
| `--text-muted`   | `#68758E` | Labels, secondaire, placeholder |
| `--text-subtle`  | `#9BA8BC` | Désactivé, hint                 |
| `--text-inverse` | `#FFFFFF` | Texte sur fonds sombres/colorés |

### Sémantiques

| Token             | Valeur    | Usage                                  |
| ----------------- | --------- | -------------------------------------- |
| `--success`       | `#0E9E6E` | Approuvé, confirmé, reçu               |
| `--success-light` | `#E6F7F1` | Background badge succès                |
| `--warning`       | `#E07800` | Conflits planning, urgence haute       |
| `--warning-light` | `#FEF3E6` | Background badge warning               |
| `--danger`        | `#F02849` | Badges notification, erreurs, critique |
| `--danger-light`  | `#FEE8EC` | Background badge danger                |
| `--info`          | `#0073E6` | Même que primary (info = marque)       |

### Couleurs de ludothèque

Chaque ludo a une couleur d'accent stockée en DB (`ludotheques.color`). Utilisée dans :

- Header de la page de connexion (fond teinté)
- Dot d'identification dans le feed cross-ludo
- Inject en CSS variable locale : `--ludo-color: [hex]` dans le layout `[ludo]`

### Règles d'association

- `--accent` = actions principales uniquement, jamais en fond de texte long
- Fond coloré → texte toujours `--text-inverse` ou vérifier contraste WCAG AA
- Les couleurs sémantiques (success/warning/danger) ne vont que sur des badges/states, pas en fond de section
- Pas de couleurs en dur dans les composants — tokens only

---

## 4. Typographie

**Famille principale :** Nunito (Google Fonts) — arrondie, douce, lisible. Proche de SF Pro Rounded.
**Chargement :** `<link rel="preconnect">` + `display=swap`, poids 400/500/700 uniquement.

### Échelle

| Classe     | Taille           | Poids | Usage                             |
| ---------- | ---------------- | ----- | --------------------------------- |
| `.display` | 2rem (32px)      | 700   | Titres de page principaux         |
| `.h1`      | 1.5rem (24px)    | 700   | Titres de section                 |
| `.h2`      | 1.25rem (20px)   | 600   | Sous-titres, en-têtes de card     |
| `.h3`      | 1rem (16px)      | 600   | Labels de groupe, captions fortes |
| card-title | 1.125rem (18px)  | 700   | Titre de carte (`--text-card-title`, DataCard) |
| `.body`    | 0.9375rem (15px) | 400   | Corps de texte standard           |
| `.small`   | 0.8125rem (13px) | 400   | Métadonnées, timestamps           |
| `.label`   | 0.75rem (12px)   | 500   | Labels navigation, badges         |

### Do / Don't

- **Do :** utiliser 700 pour les titres, 400 pour le corps, 500 pour les labels
- **Don't :** utiliser plus de 2 poids sur la même card
- **Don't :** texte en dessous de 12px
- **Do :** `line-height: 1.5` pour le corps, `1.2` pour les titres

---

## 5. Spacing, radius, ombres, breakpoints

### Espacements

```
--space-1:   4px
--space-2:   8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

Spacing interne card : `--space-5` (20px) à `--space-6` (24px)
Gutter layout : `--space-6` (24px)
Section verticale : `--space-10` (40px) à `--space-12` (48px)

### Radius

```
--radius-sm:   8px   ← inputs, badges
--radius-md:  12px   ← cards compactes, surfaces (DataTable/DataCard/listes)
--radius-lg:  16px   ← cards standard, BOUTONS (rayon unifié toutes tailles)
--radius-xl:  20px   ← modales, panels larges
--radius-pill: 999px ← pills (badges count, tabs, dots)
```

> ⚠️ Le mapping `@theme` des radius/ombres dans `src/app.css` doit poser des **valeurs littérales** (`--radius-lg: 16px`), jamais une auto-référence `var(--radius-lg)` (qui casse silencieusement la résolution Tailwind v4 et met `border-radius: 0`).

### Ombres

```
--shadow-sm:  0 2px 8px rgba(30, 50, 80, 0.06)   ← cards hover
--shadow-md:  0 8px 24px rgba(30, 50, 80, 0.08)  ← cards default
--shadow-lg:  0 16px 40px rgba(30, 50, 80, 0.12) ← modales
--shadow-focus: 0 0 0 3px rgba(0, 115, 230, 0.25) ← focus ring
```

### Breakpoints

```
--bp-sm:  640px   ← mobile large
--bp-md:  768px   ← tablette
--bp-lg: 1024px   ← desktop
--bp-xl: 1280px   ← desktop large
```

Layout max-width : `1200px` centré avec gutter `--space-6`.

---

## 6. Photographie & art direction

LudoHub est un outil interne. Pas de photographie éditoriale dans l'UI.

**Photos utilisées :**

- Photos de thèmes (upload par les ludos) : affichées telles quelles, cadre radius-lg, max 3 par thème
- Pas de traitements, pas d'overlays, pas de crop forcé — montrer le vrai matériel

**Illustrations :** none pour le MVP. États vides = text + icône monochrome uniquement.

---

## 7. Iconographie

**Set unique :** [Lucide Icons](https://lucide.dev/) — outline, 24px standard, stroke-width 1.5.
Intégration via `lucide-svelte` (tree-shakeable, pas de sprite).

**Règles :**

- Taille standard : 20px dans les listes, 24px dans les boutons/nav, 16px dans les badges
- Couleur : toujours héritée (`currentColor`) — jamais de couleur en dur dans l'icône
- Pas de remplissage (`fill: none`)

---

## 8. Motion

**Intensité : 5/10** — outil de travail quotidien, pas un portfolio. Les animations existent pour orienter, pas pour impressionner.

### Tokens

```css
--dur-fast: 150ms --dur-base: 250ms --dur-slow: 450ms --dur-reveal: 600ms
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1)
  --ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1)
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

### Moves signature

- **Transition de page :** fade 150ms `--ease-out-strong` (pas de slide — l'app est multi-section)
- **Cards au hover :** `translateY(-2px)` + `--shadow-lg` en 150ms
- **Modales/Dialogs :** scale 0.97→1 + fade, 200ms `--ease-out-strong`
- **Stagger listes :** 40ms entre items sur l'entrée initiale uniquement

### Ne s'anime JAMAIS

- La sidebar et la navigation
- Les tableaux/grilles de données (lisibilité)
- Les éléments vus en boucle (statuts, badges)
- Tout ce qui est interactif au clavier

### Règles absolues

- `prefers-reduced-motion` : toutes les transitions désactivées
- `transform` + `opacity` uniquement — jamais de `width`, `height`, `top`, `left`
- Sans JS : tous les contenus visibles (pas d'animation bloquante)

---

## 9. Composants & patterns établis

> **Source de vérité comportementale.** Toute nouvelle UI (et toute modif) doit réutiliser ces composants et suivre ces règles. Ne pas réinventer un tableau, une carte, un badge de statut ou une section repliable.

### 9.1 Boutons — `ui/button` (`buttonVariants`)

Variantes réelles (les libellés du tableau historique « primary=accent » sont **caducs**) :

| Variante      | Rendu                                                          | Usage                                          |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `default`     | fond `--primary` (bleu), texte inverse                         | Action principale (Installer, Créer, Enregistrer) |
| `outline`     | fond blanc + **bordure `--border-strong`** + `shadow-sm`       | Action secondaire, « Annuler » de dialogue      |
| `secondary`   | fond `--bg-sidebar`                                            | Alternative neutre filled                       |
| `ghost`       | **bordure `--border-strong`** transparente (texte)            | Action tertiaire texte                          |
| `destructive` | fond `--danger`/10 + bordure `--danger`/30 + texte `--danger`  | Suppression (dans une modal de confirmation)    |
| `link`        | lien souligné                                                 | Rare                                            |

**Règles absolues (palette très claire) :**

- **Aucun bouton texte ne doit être « invisible ».** `ghost` et `outline` portent donc une **bordure marquée** (`--border-strong`). Jamais de bouton texte transparent sans bordure.
- **Boutons icône-only = sans bordure.** Géré par un `compoundVariants` dans `button.svelte` (variant ghost/outline + size `icon*` → `border-transparent bg-transparent shadow-none`). L'icône suffit ; ne pas ajouter de bordure manuellement.
- **Rayon unifié** : toutes les tailles héritent du `rounded-lg` de base (pas de rayon par taille).
- Actions de ligne (tableaux, cartes) → boutons **icône** `size="icon-sm"`, variante `ghost`, + `<span class="sr-only">` + `title`. Modèle : `SupplyCard.svelte`.

### 9.2 Badges — `ui/badge`

Variantes : `default` (primary), `secondary`, `success` (`--success-light`/`--success`), `warning` (`--warning-light`/`--warning`), `destructive`, `outline`, `ghost`, `link`.

- **Statuts métier → `<StatusBadge status=… />`** (`ui/badge/StatusBadge.svelte`), jamais un badge `outline` brut (invisible). Map : `en_attente→warning`, `approuve/actif/recu/achete→success`, `refuse/annule→destructive`, `retourne→secondary`.
- Ne pas recréer de pseudo-badge custom (`<span>` stylé). Réutiliser `<Badge>`.

### 9.3 Surfaces de données — tableaux & cartes

- **Tout tableau** passe par `<DataTable>` (`ui/data-table`) : surface blanche (`--bg-card` + `--border` + `--radius-md` + `shadow-sm`), en-tête teinté, et **bascule automatique en cartes sous 640px** (snippets `head` / `body` / `cards`). Pas de `<Table.Root>` nu dans une page.
- **Carte de données unifiée** : `<DataCard>` (`ui/data-card`) — titre + point/badge optionnel + lien externe + notes + byline + actions (snippets). Les cartes domaine (`SupplyCard`, `WishlistItem`) en sont de **fins adaptateurs** ; toute nouvelle liste suit ce modèle.
- Toute liste/zone de contenu se pose sur une surface carte (`--bg-card` + `--border` + `--radius-md` + `shadow-sm`), jamais transparente sur `--bg-base`.

### 9.4 Sections repliables — `ui/collapsible-section`

`<CollapsibleSection title count>` (basé sur `<details>`, chevron-down qui pivote). Utilisé pour masquer par défaut le contenu « terminé/peu consulté » (jeux achetés, matériel reçu).

### 9.5 Confirmations destructives

Toute suppression/action irréversible passe par un `AlertDialog` (trigger = bouton/icône, footer `Annuler` + bouton `destructive`). Modèle : `SupplyCard.svelte`, `ThemeItemList.svelte`.

### 9.6 Primitives shadcn

`ui/button`, `ui/badge`, `ui/dialog`, `ui/alert-dialog`, `ui/input`, `ui/label`, `ui/select`, `ui/table`, `ui/separator`, `ui/date-picker`. **Extensions maison** (variantes ajoutées, nouveaux composants `data-table`/`data-card`/`collapsible-section`/`StatusBadge`) vivent aussi sous `ui/` et sont la référence.
