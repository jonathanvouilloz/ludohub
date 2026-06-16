# Plan d'exécution — LudoHub

## Epics actives

| #   | Feature                                                     | Taille | Statut   | Fichier                                                       |
| --- | ----------------------------------------------------------- | ------ | -------- | ------------------------------------------------------------- |
| 01  | SETUP — Socle technique (schema, Drizzle, env, auth base)   | M      | **DONE** | [01-setup.md](features/01-setup.md)                           |
| 02  | AUTH — Connexion multi-tenant (slug, password, member pick) | M      | **DONE** | [02-auth.md](features/02-auth.md)                             |
| 03  | MEMBRES — CRUD membres + rôles                              | S      | **DONE** | [03-membres.md](features/03-membres.md)                       |
| 04  | PLANNING — Saisons, samedis, assignations, swap             | L      | **DONE** | [04-planning.md](features/04-planning.md)                     |
| 05  | ABSENCES — Demande, approbation, intégration planning       | M      | **DONE** | [05-absences.md](features/05-absences.md)                     |
| 06  | THÈMES — Catalogue, items, photos Vercel Blob, prêts        | L      | **DONE** | [06-themes.md](features/06-themes.md)                         |
| 07  | RÉSEAU — Demandes d'aide cross-ludo                         | M      | TODO     | [07-reseau.md](features/07-reseau.md)                         |
| 08  | WISHLIST + MATÉRIEL — Listes internes simples               | S      | TODO     | [08-wishlist-materiaux.md](features/08-wishlist-materiaux.md) |
| 09  | ADMIN — Super admin (CRUD ludos, logs)                      | M      | TODO     | [09-admin.md](features/09-admin.md)                           |
| 10  | TESTS E2E — Playwright flows critiques (5 flows)            | M      | TODO     | [10-tests-e2e.md](features/10-tests-e2e.md)                   |

## Prochaines étapes prioritaires

1. **01-SETUP** : Créer le projet SvelteKit, schema Drizzle complet, Neon connexion, Better Auth base
2. **02-AUTH** : Login page, middleware session, cookie 30j
3. **03-MEMBRES** : CRUD (s'appuie sur auth pour les guards)
4. **04-PLANNING** : Feature core, le plus complexe
5. **05-ABSENCES** : Dépend du planning (warnings de conflit)
6. **06-THÈMES** : Feature de partage — cœur du réseau
7. **07-RÉSEAU** : Feed cross-ludo (dépend de 06 pour les thèmes)
8. **08 + 09** : Features simples, parallélisables
9. **10-TESTS** : Playwright en continu avec chaque feature

## Ordre de dépendances

```
01-SETUP
   └── 02-AUTH
         └── 03-MEMBRES
               ├── 04-PLANNING
               │     └── 05-ABSENCES
               ├── 06-THÈMES
               │     └── 07-RÉSEAU
               ├── 08-WISHLIST + MATÉRIEL
               └── 09-ADMIN
10-TESTS (transversal, tout au long)
```

## Notes d'architecture

- Le schema Drizzle complet est écrit en 01-SETUP (toutes les tables d'un coup) pour avoir une vision cohérente avant de coder les services
- Better Auth est configuré en 01-SETUP mais les pages de login sont dans 02-AUTH
- Les features cross-ludo (RÉSEAU, catalog thèmes) s'appuient sur `src/routes/reseau/` (hors scope `[ludo]`)
- L'admin est dans `src/routes/admin/`, protégé par `SUPER_ADMIN_PASSWORD` distinct des sessions ludo

---

## Archive

| #   | Feature                                         | Terminée le |
| --- | ----------------------------------------------- | ----------- |
| 01  | SETUP — Socle technique                         | 2026-06-15  |
| 02  | AUTH — Connexion multi-tenant                   | 2026-06-15  |
| 03  | MEMBRES — CRUD membres + rôles                  | 2026-06-15  |
| 04  | PLANNING — Saisons, samedis, assignations, swap | 2026-06-16  |
| 05  | ABSENCES — Demande, approbation, warnings        | 2026-06-16  |
| 06  | THÈMES — Catalogue, items, photos Blob, prêts    | 2026-06-16  |
