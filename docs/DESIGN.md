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

| Token | Valeur | Usage |
|-------|--------|-------|
| `--primary` | `#0073E6` | Navigation active, liens, actions secondaires |
| `--primary-dark` | `#005BA8` | Hover bouton primary, état actif |
| `--primary-light` | `#E8F2FE` | Background hover nav, pills légères |
| `--accent` | `#C0007A` | CTA principal (bouton primaire, FAB) |
| `--accent-dark` | `#9A0062` | Hover/focus accent |
| `--accent-light` | `#FDE8F4` | Background badge accent |

### Surfaces & lignes

| Token | Valeur | Usage |
|-------|--------|-------|
| `--bg-base` | `#EEF2F8` | Fond général (gris bleuté) |
| `--bg-card` | `#FFFFFF` | Cartes, modales, dropdowns |
| `--bg-sidebar` | `#F1F5FA` | Sidebar |
| `--bg-hover` | `#F5F8FC` | Hover sur items de liste |
| `--border` | `#DDE3EE` | Séparateurs, bordures de cards |
| `--border-strong` | `#C4CDD9` | Inputs, borders actives |

### Ink (texte)

| Token | Valeur | Usage |
|-------|--------|-------|
| `--text-main` | `#25324B` | Corps de texte principal |
| `--text-muted` | `#68758E` | Labels, secondaire, placeholder |
| `--text-subtle` | `#9BA8BC` | Désactivé, hint |
| `--text-inverse` | `#FFFFFF` | Texte sur fonds sombres/colorés |

### Sémantiques

| Token | Valeur | Usage |
|-------|--------|-------|
| `--success` | `#0E9E6E` | Approuvé, confirmé, reçu |
| `--success-light` | `#E6F7F1` | Background badge succès |
| `--warning` | `#E07800` | Conflits planning, urgence haute |
| `--warning-light` | `#FEF3E6` | Background badge warning |
| `--danger` | `#F02849` | Badges notification, erreurs, critique |
| `--danger-light` | `#FEE8EC` | Background badge danger |
| `--info` | `#0073E6` | Même que primary (info = marque) |

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

| Classe | Taille | Poids | Usage |
|--------|--------|-------|-------|
| `.display` | 2rem (32px) | 700 | Titres de page principaux |
| `.h1` | 1.5rem (24px) | 700 | Titres de section |
| `.h2` | 1.25rem (20px) | 600 | Sous-titres, en-têtes de card |
| `.h3` | 1rem (16px) | 600 | Labels de groupe, captions fortes |
| `.body` | 0.9375rem (15px) | 400 | Corps de texte standard |
| `.small` | 0.8125rem (13px) | 400 | Métadonnées, timestamps |
| `.label` | 0.75rem (12px) | 500 | Labels navigation, badges |

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
--radius-md:  12px   ← cards compactes
--radius-lg:  16px   ← cards standard
--radius-xl:  20px   ← modales, panels larges
--radius-pill: 999px ← boutons (pill shape)
```

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
--dur-fast:   150ms
--dur-base:   250ms
--dur-slow:   450ms
--dur-reveal: 600ms

--ease-out-strong:    cubic-bezier(0.23, 1, 0.32, 1)
--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1)
--ease-drawer:        cubic-bezier(0.32, 0.72, 0, 1)
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

## 9. Inventaire composants

*Section vivante — à compléter au fil du build. Chaque composant validé s'ajoute ici + démo sur /styleguide.*

| Composant | Variantes | Page styleguide |
|-----------|-----------|-----------------|
| Button | primary (accent) / secondary (primary) / ghost / danger — toutes avec état hover, active, focus, disabled | `/styleguide#buttons` |
| Badge | success / warning / danger / info / neutral — avec dot optionnel | `/styleguide#badges` |
| Card | default (shadow-md) / hover (shadow-lg + translateY) | `/styleguide#cards` |
| Input | default / focus / error / disabled | `/styleguide#inputs` |
| Dialog | avec header + footer d'actions | `/styleguide#dialogs` |
| Sidebar nav item | default / active / hover | `/styleguide#nav` |

*À ajouter au fur et à mesure : SlotCard, MemberPicker, ThemeCard, HelpRequestCard, PlanningGrid...*
