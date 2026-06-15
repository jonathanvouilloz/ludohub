# HANDOFF — 2026-06-16

## Features actives

| Feature       | Fichier                                            | Statut       |
| ------------- | -------------------------------------------------- | ------------ |
| 04 — PLANNING | [features/04-planning.md](features/04-planning.md) | **EN COURS** |
| 05 — ABSENCES | [features/05-absences.md](features/05-absences.md) | EN ATTENTE   |

## Reprendre ici

04-PLANNING — **Bug 403 à corriger** : membre simple (Bruno Martin) refusé sur `/planning`. Cause probable : `locals.ludo`/`locals.currentMember` lus en parallèle avant que `[ludo]/+layout.server.ts` ne les pose → passer à `await parent()` dans les 3 `+page.server.ts` planning. Puis régler warning Better Auth (`BETTER_AUTH_URL`). Détail complet dans le fichier feature.
Commit : (session planning WIP, non committé)
