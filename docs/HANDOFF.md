# HANDOFF — 2026-06-24

## Features actives

| Feature                  | Fichier                                                              | Statut                               |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------ |
| 18 — DOCUMENTATION /aide | [features/18-documentation-aide.md](features/18-documentation-aide.md) | **EN COURS** — Batch 1 (Démarrer/Planning/Absences) + refonte GitBook /aide globale ; reste Batch 2 & 3 |
| Backlog revue (suivi)    | [BACKLOG.md](BACKLOG.md)                                            | EN COURS — batch 1 + 2 livrés        |
| 17 — NEWSLETTER          | [features/17-newsletter.md](features/17-newsletter.md)             | DONE code (db:push + import à jouer) |
| 12 — TESTS E2E           | [features/10-tests-e2e.md](features/10-tests-e2e.md)              | EN ATTENTE                           |

## Reprendre ici

**Doc `/aide` (feature 18)** — Aide passée en **URL globale `/aide`** type guide GitBook (sommaire + recherche + lightbox) ; modules Démarrer/Planning/Absences/Thèmes livrés (13 captures).
Prochain : **Batch 2** = Réseau, Jeux/Matériel, Newsletter (seed + section config + content + recapture), puis Batch 3 = Fréquentation, Paramètres. Détail + pièges dans le fichier feature.
À part : Backlog batch 3 ; newsletter Pâquis = `pnpm db:push` puis `pnpm tsx scripts/import-newsletter-paquis.ts --commit` (DB prod).
