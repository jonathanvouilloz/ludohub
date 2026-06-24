# HANDOFF — 2026-06-24

## Features actives

| Feature                  | Fichier                                                              | Statut                               |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------ |
| 18 — DOCUMENTATION /aide | [features/18-documentation-aide.md](features/18-documentation-aide.md) | **EN COURS** — Batch 1 + Batch 2 partiel (Réseau/Jeux/Matériel, 20 captures) ; reste Newsletter + Batch 3 |
| Backlog revue (suivi)    | [BACKLOG.md](BACKLOG.md)                                            | EN COURS — batch 1 + 2 livrés        |
| 17 — NEWSLETTER          | [features/17-newsletter.md](features/17-newsletter.md)             | DONE code (db:push + import à jouer) |
| 12 — TESTS E2E           | [features/10-tests-e2e.md](features/10-tests-e2e.md)              | EN ATTENTE                           |

## Reprendre ici

**Doc `/aide` (feature 18)** — Modules Démarrer/Planning/Absences/Thèmes/Jeux/Matériel/Réseau livrés (20 captures, sommaire accordéon). Seed démo = tenants `demo` + `demo-voisine`.
Prochain : **Newsletter** (essentiel : Campagnes/éditeur/Contacts → seed `campaigns`+`newsletter_contacts` dans `demo`, section config + `content/newsletter.ts`, recapture), puis **Batch 3** = Fréquentation, Paramètres. Détail + pièges dans le fichier feature.
Commit : [753b8fa] feat(aide): batch 2 partiel doc /aide — réseau, jeux, matériel + polish sommaire
