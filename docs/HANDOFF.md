# HANDOFF — 2026-06-18

## Features actives

| Feature              | Fichier                                                      | Statut          |
| -------------------- | ----------------------------------------------------------- | --------------- |
| 13 — THÈMES check-up | [features/13-themes-checkup.md](features/13-themes-checkup.md) | DONE (itératif) |
| 12 — TESTS E2E       | [features/10-tests-e2e.md](features/10-tests-e2e.md)        | TODO            |

## Reprendre ici

**À faire avant test** : `pnpm db:push` (nouvelle colonne `theme_items.condition`).
**Prochain epic : 12-TESTS E2E** (Playwright) — setup `playwright.config.ts` + seed DB test + helper auth, puis flows F1→F5.
Commit : feat(themes): bandeau installation bleu + clôture via check-up final (état reporté sur le thème)
