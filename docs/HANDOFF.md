# HANDOFF — 2026-06-24

## Features actives

| Feature                  | Fichier                                                | Statut                             |
| ------------------------ | ------------------------------------------------------ | ---------------------------------- |
| Backlog revue (suivi)    | [BACKLOG.md](BACKLOG.md)                               | **EN COURS** — batch 1 fait        |
| 17 — NEWSLETTER          | [features/17-newsletter.md](features/17-newsletter.md) | DONE code (db:push + import à jouer) |
| 12 — TESTS E2E           | [features/10-tests-e2e.md](features/10-tests-e2e.md)   | EN ATTENTE                         |

## Reprendre ici

**Backlog `docs/BACKLOG.md`** — Batch 1 (6 quick wins UX) livré et committé. Prochain : choisir le batch 2 (items plus gros : events fréquentation multi/jour + types par ludo, tracking emailing/RGPD, exports PDF, print matériel/planning, pilote TanStack, bloc notifs thème sur l'accueil).
À part : newsletter Pâquis = `pnpm db:push` puis `pnpm tsx scripts/import-newsletter-paquis.ts --commit` (DB prod, action Jonathan).
Commit : [4aa6f03] docs: backlog revue produit 2026-06-24 + suivi batch 1
