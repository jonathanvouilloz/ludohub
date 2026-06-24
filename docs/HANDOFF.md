# HANDOFF — 2026-06-24

## Features actives

| Feature                  | Fichier                                                              | Statut                               |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------ |
| 18 — DOCUMENTATION /aide | [features/18-documentation-aide.md](features/18-documentation-aide.md) | **EN COURS** — 8 modules livrés (24 captures) ; reste Batch 3 = Fréquentation + Paramètres |
| Backlog revue (suivi)    | [BACKLOG.md](BACKLOG.md)                                            | EN COURS — batch 1 + 2 livrés        |
| 17 — NEWSLETTER          | [features/17-newsletter.md](features/17-newsletter.md)             | DONE (reste vérif domaine Resend, hors code) |
| 12 — TESTS E2E           | [features/10-tests-e2e.md](features/10-tests-e2e.md)              | EN ATTENTE                           |

## Reprendre ici

**Doc `/aide` (feature 18)** — Modules Démarrer/Planning/Absences/Thèmes/Jeux/Matériel/Newsletter/Réseau livrés (24 captures). Prochain : **Batch 3** = Fréquentation + Paramètres (seed si besoin + section config + `content/[module].ts` + recapture, bump `docsVersion`).
À part : **déployer** pour réparer la page Contacts `paquis-secheron` en prod (fix `1802b95`).
Commit : [e8a713d] feat(aide): module Newsletter dans la doc /aide
