# Styleguide — LudoHub

## Architecture des fichiers

```
src/
├── lib/
│   ├── server/
│   │   ├── db/              ← queries Drizzle (par domaine)
│   │   ├── services/        ← logique métier (par domaine)
│   │   ├── auth.ts          ← config Better Auth
│   │   └── schema.ts        ← schema Drizzle complet
│   ├── components/
│   │   ├── ui/              ← shadcn-svelte (ne pas modifier)
│   │   ├── planning/        ← composants domaine planning
│   │   ├── themes/          ← composants domaine thèmes
│   │   └── shared/          ← composants transversaux
│   └── utils/
│       ├── dates.ts         ← calcul samedis, formatage CH
│       └── permissions.ts   ← guards responsable/membre
├── routes/
│   ├── [ludo]/              ← scope par ludo
│   ├── reseau/              ← cross-ludo
│   ├── admin/               ← super admin
│   └── auth/
└── app.html
```

## Règles d'architecture

### Séparation des responsabilités
```
+page.server.ts   → load() + actions() uniquement. Pas de logique métier.
services/*.ts     → logique métier. Appelle db/*.ts. Retourne des types typés.
db/*.ts           → queries Drizzle uniquement. Pas de logique. Retourne des rows.
```

### Exemple correct
```typescript
// db/members.ts
export async function getMembersByLudo(ludoId: string): Promise<MemberRow[]> {
  return db.select().from(members).where(eq(members.ludoId, ludoId))
}

// services/planning.ts
export async function getActiveMembersForSlot(ludoId: string, slotId: string) {
  const allMembers = await getMembersByLudo(ludoId)
  const assigned = await getAssignmentsForSlot(slotId)
  return allMembers.filter(m => m.isActive && !assigned.find(a => a.memberId === m.id))
}

// +page.server.ts
export const load = async ({ params }) => {
  const members = await getActiveMembersForSlot(params.ludo, params.slotId)
  return { members }
}
```

## Nommage

| Contexte | Convention | Exemple |
|----------|-----------|---------|
| Composants Svelte | PascalCase | `MemberCard.svelte` |
| Pages SvelteKit | Fichiers système | `+page.svelte`, `+layout.server.ts` |
| Routes | kebab-case | `/planning/saison-2025` |
| Fonctions | camelCase | `getActiveMembers()` |
| Tables DB | snake_case pluriel | `saturday_slots` |
| Colonnes DB | snake_case | `is_active`, `ludo_id` |
| Types/interfaces | PascalCase suffixé | `MemberRow`, `AbsenceInsert` |
| Stores Svelte | camelCase suffixe Store | `membersStore` |
| Variables d'env | SCREAMING_SNAKE_CASE | `DATABASE_URL` |

## Conventions Svelte

### Props
```svelte
<script lang="ts">
  // Props avec types explicites
  let { member, onEdit }: { member: MemberRow; onEdit: () => void } = $props()
</script>
```

### Actions de formulaire
```typescript
// Utiliser les form actions SvelteKit, pas fetch manuel
export const actions = {
  create: async ({ request, locals }) => {
    const data = await request.formData()
    // validation → service → redirect ou return fail()
  }
}
```

### Gestion d'état
- Préférer les stores Svelte pour l'état partagé entre composants
- Les données serveur passent par `load()` → pas de fetch client si évitable
- Utiliser `$state()` (Svelte 5 runes) pour l'état local des composants

## Conventions de commits
```
feat(scope): description courte en minuscules
fix(scope): correction de bug
docs: mise à jour documentation
style: formatage (pas de logique)
refactor(scope): refactoring sans changement de comportement
test(scope): ajout/modification de tests
chore: maintenance, dépendances
```

Scopes : `auth`, `planning`, `absences`, `themes`, `reseau`, `wishlist`, `supplies`, `admin`, `db`, `ui`

## Tailwind + shadcn-svelte

- Utiliser les composants shadcn-svelte en priorité (Button, Card, Dialog, etc.)
- Ne jamais modifier les fichiers `src/lib/components/ui/` directement
- Créer des composants wrapper dans `src/lib/components/[domaine]/` si customisation nécessaire
- Tokens CSS définis dans `src/app.css` (généré par /init-design)
- Tailwind v4 : pas de `tailwind.config.js` — config dans `app.css` via `@theme`

## Gestion des erreurs

- Validation à la frontière (form actions, API routes)
- `fail(400, { error: 'message' })` pour les erreurs de validation
- `error(404, 'Ludothèque introuvable')` pour les erreurs SvelteKit
- Pas de try/catch dans les services si l'erreur doit remonter

## Internationalisation

- L'app est en **français uniquement** (pas d'i18n prévue)
- Tous les labels, messages d'erreur et textes UI en français
- Format de date : `DD.MM.YYYY` (convention suisse)
- Devise : CHF (pas d'€)
- Timezone : Europe/Zurich
