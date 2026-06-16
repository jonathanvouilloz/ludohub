# HANDOFF — 2026-06-16

## Features actives

| Feature            | Fichier                                                      | Statut       |
| ------------------ | ------------------------------------------------------------ | ------------ |
| 10 — NOTIFICATIONS | [features/10-notifications.md](features/10-notifications.md) | **DONE**     |
| 11 — ADMIN         | [features/11-admin.md](features/11-admin.md)                 | EN ATTENTE   |

## Reprendre ici

**11-ADMIN** — Prochain epic : super admin (CRUD ludos + consultation `activity_log`, désormais peuplé par le dispatcher de l'epic 10). Protégé par `SUPER_ADMIN_PASSWORD`, routes `src/routes/admin/*`.
Épic 10 terminé : notifs in-app + dispatcher unique (`emitEvent` → `activity_log` + fan-out notifications), badge dans le shell, page `/reseau/notifications`. Fix régression epic 08 (catalogue `/reseau/themes` réaccessible via sous-nav réseau). 64 tests verts, check/lint OK. Tests E2E reportés à l'epic 12.
Commit : [0ffac48] feat(notifs): notifications in-app + dispatcher (epic 10)
