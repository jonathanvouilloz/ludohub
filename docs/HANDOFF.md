# HANDOFF — 2026-06-24

## Features actives

| Feature                  | Fichier                                                | Statut                               |
| ------------------------ | ------------------------------------------------------ | ------------------------------------ |
| Backlog revue (suivi)    | [BACKLOG.md](BACKLOG.md)                               | **EN COURS** — batch 1 + 2 livrés    |
| 17 — NEWSLETTER          | [features/17-newsletter.md](features/17-newsletter.md) | DONE code (db:push + import à jouer) |
| 12 — TESTS E2E           | [features/10-tests-e2e.md](features/10-tests-e2e.md)   | EN ATTENTE                           |

## Reprendre ici

**Backlog `docs/BACKLOG.md`** — Batch 2 livré (accueil objets à traiter, print thème, types d'événement par ludo, newsletter tracking/RGPD/pagination/TanStack) + optimisation UX du modal de clôture. **Action Jonathan : `pnpm db:push`** (table `event_types` + colonne `attendance_records.event_type_id`, additif) pour activer les types d'événement.
Prochain : batch 3 (print planning, exports PDF fréquentation, comparaison admin, refonte template mail) — ou epic **12-TESTS E2E**.
À part : newsletter Pâquis = `pnpm db:push` puis `pnpm tsx scripts/import-newsletter-paquis.ts --commit` (DB prod).
