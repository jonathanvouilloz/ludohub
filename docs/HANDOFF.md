# HANDOFF — 2026-07-30

## Features actives

| Feature                   | Fichier                                                                    | Statut                                              |
| ------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| 19 — REVUE PRODUIT 2026-07 | [features/19-revue-produit-2026-07.md](features/19-revue-produit-2026-07.md) | **EN COURS** — 3 correctifs codés, **non vérifiés** |
| Backlog produit (suivi)   | [BACKLOG.md](BACKLOG.md)                                                    | EN COURS — statuts, décisions, questions             |
| 18 — DOCUMENTATION /aide  | [features/18-documentation-aide.md](features/18-documentation-aide.md)      | EN ATTENTE — reste Batch 3 (Fréquentation + Paramètres) |
| 12 — TESTS E2E            | [features/10-tests-e2e.md](features/10-tests-e2e.md)                        | EN ATTENTE                                           |

## Reprendre ici

**Epic 19** — `pnpm install` (node_modules corrompu), puis `pnpm check` + `pnpm test` pour vérifier
le batch de correctifs, avant de passer aux horaires simples dans les settings (§9 du backlog).
À part : **déployer** pour réparer la page Contacts `paquis-secheron` en prod (fix `1802b95`).
Commit : [3d16695] docs(backlog): revue produit 2026-07-22
