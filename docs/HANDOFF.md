# HANDOFF — 2026-06-24

## Features actives

| Feature                  | Fichier                                                              | Statut                               |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------ |
| 18 — DOCUMENTATION /aide | [features/18-documentation-aide.md](features/18-documentation-aide.md) | **EN COURS** — module Thèmes (étalon) fait, 8 restants |
| Backlog revue (suivi)    | [BACKLOG.md](BACKLOG.md)                                            | EN COURS — batch 1 + 2 livrés        |
| 17 — NEWSLETTER          | [features/17-newsletter.md](features/17-newsletter.md)             | DONE code (db:push + import à jouer) |
| 12 — TESTS E2E           | [features/10-tests-e2e.md](features/10-tests-e2e.md)              | EN ATTENTE                           |

## Reprendre ici

**Doc `/aide` (feature 18)** — Skill réutilisable `user-docs` créé + module Thèmes livré comme étalon (seed démo, harness Playwright annoté, page `/[ludo]/aide`). Commit [65c1806].
Prochain : dérouler les 8 modules restants (seed + config + content par module, régénérer captures) + lien « Aide » dans la nav. Détail dans le fichier feature.
À part : Backlog batch 3 ; newsletter Pâquis = `pnpm db:push` puis `pnpm tsx scripts/import-newsletter-paquis.ts --commit` (DB prod).
