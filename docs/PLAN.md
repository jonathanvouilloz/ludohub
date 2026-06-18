# Plan d'exécution — LudoHub

## Epics actives

| #   | Feature                                                          | Taille | Statut       | Fichier                                                       |
| --- | ---------------------------------------------------------------- | ------ | ------------ | ------------------------------------------------------------- |
| 01  | SETUP — Socle technique (schema, Drizzle, env, auth base)        | M      | **DONE**     | [01-setup.md](features/01-setup.md)                           |
| 02  | AUTH — Connexion multi-tenant (slug, password, member pick)      | M      | **DONE**     | [02-auth.md](features/02-auth.md)                             |
| 03  | MEMBRES — CRUD membres + rôles                                   | S      | **DONE**     | [03-membres.md](features/03-membres.md)                       |
| 04  | PLANNING — Saisons, samedis, assignations, swap                  | L      | **DONE**     | [04-planning.md](features/04-planning.md)                     |
| 05  | ABSENCES — Demande, approbation, intégration planning            | M      | **DONE**     | [05-absences.md](features/05-absences.md)                     |
| 06  | THÈMES — Catalogue, items, photos Vercel Blob, prêts             | L      | **DONE**     | [06-themes.md](features/06-themes.md)                         |
| 07  | RÉSEAU — Demandes d'aide cross-ludo + flow pull thèmes           | M      | **DONE**     | [07-reseau.md](features/07-reseau.md)                         |
| 08  | NAVIGATION — Shell applicatif (sidebar desktop + tab bar mobile) | M      | **DONE**     | [08-navigation.md](features/08-navigation.md)                 |
| 09  | WISHLIST + MATÉRIEL — Listes internes simples                    | S      | **DONE**     | [09-wishlist-materiaux.md](features/09-wishlist-materiaux.md) |
| 10  | NOTIFICATIONS — Notifs in-app + dispatcher + activity_log        | M      | **DONE**     | [10-notifications.md](features/10-notifications.md)           |
| 11  | ADMIN — Super admin (CRUD ludos, logs)                           | M      | **DONE**     | [11-admin.md](features/11-admin.md)                           |
| 12  | TESTS E2E — Playwright flows critiques                           | M      | TODO         | [12-tests-e2e.md](features/12-tests-e2e.md)                   |
| 13  | THÈMES — Installations & check-ups                               | M-L    | **DONE**     | [13-themes-checkup.md](features/13-themes-checkup.md)         |
| 14  | DESIGN — Refonte UI transversale (système de composants)         | L      | **DONE**     | [14-design-refonte.md](features/14-design-refonte.md)         |
| 15  | FRÉQUENTATION — Relevé & clôture d'ouverture (+ météo)           | M      | **DONE**     | [14-frequentation.md](features/14-frequentation.md)           |

## Prochaines étapes prioritaires

1. **09-WISHLIST + MATÉRIEL** : dernières features de contenu interne (listes simples).
2. **10-NOTIFICATIONS** : notifs in-app (dépend du shell pour le badge + de tous les
   domaines de contenu existants). Dispatcher unique qui alimente notifs **et** `activity_log`.
3. **11-ADMIN** : super admin (CRUD ludos + consultation `activity_log` peuplé par le dispatcher).
4. **12-TESTS E2E** : Playwright sur les flows critiques (transversal, à consolider en fin).
   Inclut les 3 tests du shell de navigation (08) reportés ici.
5. **13-THÈMES Installations & check-ups** : feature cadrée (spec + PRD à jour),
   prête à coder. Étend l'epic 06 : notion d'installation (sous-ensemble sorti, daté)
   + check-ups quotidiens présent/manquant. Repris de samediLudoV2, jamais porté jusqu'ici.

## Ordre de dépendances

```
01-SETUP
   └── 02-AUTH
         └── 03-MEMBRES
               ├── 04-PLANNING
               │     └── 05-ABSENCES
               ├── 06-THÈMES
               │     └── 07-RÉSEAU
               ├── 08-NAVIGATION ────────────┐  (shell transversal : englobe toutes les sections)
               │     └── 10-NOTIFICATIONS     │  (badge dans le shell + dispatcher → activity_log)
               ├── 09-WISHLIST + MATÉRIEL ────┘
               └── 11-ADMIN                      (consomme activity_log alimenté par 10)
12-TESTS (transversal, tout au long)
```

## Notes d'architecture

- Le schema Drizzle complet est écrit en 01-SETUP (toutes les tables d'un coup) pour avoir une vision cohérente avant de coder les services
- Better Auth est configuré en 01-SETUP mais les pages de login sont dans 02-AUTH
- Les features cross-ludo (RÉSEAU, catalog thèmes) s'appuient sur `src/routes/reseau/` (hors scope `[ludo]`)
- L'admin est dans `src/routes/admin/`, protégé par `SUPER_ADMIN_PASSWORD` distinct des sessions ludo
- **Navigation (08)** : le PRD/DESIGN spécifiaient déjà la sidebar (72px, états nav sur
  `/styleguide#nav`, token `--ease-drawer`) mais aucun epic ne l'avait prise en charge —
  01-SETUP a posé le socle technique, pas le shell visuel. 08 comble ce trou.
- **Notifications (10) ≠ activity_log** : deux préoccupations distinctes (audience, cycle
  lu/non-lu, cible destinataire ≠ acteur, fan-out 1→N). On **n'fusionne pas** les tables, on
  **unifie le point d'émission** : les services émettent un événement → un dispatcher écrit
  la ligne d'audit (`activity_log`, pour 11-ADMIN) **et** les notifications par destinataire.

---

## Archive

| #   | Feature                                               | Terminée le |
| --- | ----------------------------------------------------- | ----------- |
| 01  | SETUP — Socle technique                               | 2026-06-15  |
| 02  | AUTH — Connexion multi-tenant                         | 2026-06-15  |
| 03  | MEMBRES — CRUD membres + rôles                        | 2026-06-15  |
| 04  | PLANNING — Saisons, samedis, assignations, swap       | 2026-06-16  |
| 05  | ABSENCES — Demande, approbation, warnings             | 2026-06-16  |
| 06  | THÈMES — Catalogue, items, photos Blob, prêts         | 2026-06-16  |
| 07  | RÉSEAU — Demandes d'aide cross-ludo + flow pull       | 2026-06-16  |
| 08  | NAVIGATION — Shell (sidebar desktop + tab bar mobile) | 2026-06-16  |
| 09  | WISHLIST + MATÉRIEL — Listes internes simples         | 2026-06-16  |
| 10  | NOTIFICATIONS — Notifs in-app + dispatcher            | 2026-06-16  |
| 13  | THÈMES — Installations & check-ups (« mini theme kit ») | 2026-06-17  |
