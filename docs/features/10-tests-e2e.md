# Feature : TESTS E2E — Playwright flows critiques

**Epic :** 10 | **Taille :** M | **Statut :** TODO

## Description

Suite de tests Playwright couvrant les 5 flows critiques identifiés dans le PRD. À implémenter après chaque feature concernée, pas en une fois à la fin.

## Flows à couvrir

### F1 — Connexion à une ludo

```
slug → page login → mot de passe → sélection membre → dashboard
```

- [ ] Login réussi
- [ ] Mauvais mot de passe → erreur générique
- [ ] Slug inconnu → 404
- [ ] Membre désactivé → non visible

### F2 — Créer une saison et assigner un membre

```
admin → saisons → nouvelle saison → liste samedis → assigner membre → vérifier
```

- [ ] Saison créée avec les samedis générés
- [ ] Assignation d'un membre visible dans la grille
- [ ] Double assignation bloquée

### F3 — Absence : soumettre + approuver

```
membre → nouvelle absence → responsable → approuver → warning dans planning
```

- [ ] Demande créée en `en_attente`
- [ ] Responsable approuve → `approuvé`
- [ ] Warning visible si membre assigné sur les dates

### F4 — Prêter un thème (push)

```
ludo A → thème → prêter → ludo B → thème visible "En prêt"
```

- [ ] Prêt actif créé
- [ ] Double prêt bloqué
- [ ] Historique visible sur la fiche thème

### F5 — Demande d'aide cross-ludo + réponse

```
ludo A → demande → ludo B voit → répond → ludo A confirme → pourvue
```

- [ ] Demande visible dans le feed cross-ludo
- [ ] Réponse enregistrée avec identité + ludo
- [ ] Confirmation → statut "pourvue"

## Setup Playwright

- [ ] `playwright.config.ts` — base URL, browsers (chromium only pour MVP)
- [ ] `tests/fixtures/seed.ts` — seed DB de test (2 ludos, membres, thèmes)
- [ ] `tests/helpers/auth.ts` — helper login programmatique (bypass UI)

## Commandes

```bash
pnpm test:e2e              # tous les tests
pnpm test:e2e --grep F1    # flow spécifique
pnpm test:e2e --ui         # mode interactif
```
