# HANDOFF — 2026-06-16

## Features actives

| Feature                  | Fichier                                                              | Statut     |
| ------------------------ | ------------------------------------------------------------------- | ---------- |
| 09 — WISHLIST + MATÉRIEL | [features/09-wishlist-materiaux.md](features/09-wishlist-materiaux.md) | **DONE**   |
| 10 — NOTIFICATIONS       | [features/10-notifications.md](features/10-notifications.md)        | EN ATTENTE |

## Reprendre ici

**10-NOTIFICATIONS** — Prochain epic : notifs in-app + dispatcher unique (alimente notifs **et** `activity_log`). Les services 09 (wishes/supplies) sont des points d'émission naturels. Lire `docs/features/10-notifications.md`.
Épic 09 terminé : wishlist jeux (`[ludo]/games`) + demandes matériel (`[ludo]/supplies`), branchés au shell de nav (réordonné par usage). 52 tests verts, check/lint OK. Tests E2E reportés à l'epic 12.
Commit : [7fa8f46] feat(interne): wishlist jeux + demandes de matériel (epic 09)
