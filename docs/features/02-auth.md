# Feature : AUTH — Connexion multi-tenant

**Epic :** 02 | **Taille :** M | **Statut :** TODO

## Description
Système d'authentification multi-tenant. Chaque ludo a un slug URL unique et un mot de passe commun. Le flow : accès à `/[slug]` → page de connexion brandée → saisie du mot de passe ludo → sélection du membre → dashboard.

## Tâches

### Pages
- [ ] `src/routes/auth/[ludo]/+page.svelte` — page de connexion par slug
  - Header avec couleur + nom de la ludo
  - Champ mot de passe
  - Liste déroulante des membres actifs (apparaît après vérification du password)
  - Message d'erreur générique si mot de passe incorrect
- [ ] `src/routes/auth/[ludo]/+page.server.ts` — load (vérif slug) + action login

### Middleware
- [ ] `src/routes/[ludo]/+layout.server.ts`
  - Vérifier que le slug existe → 404 si non
  - Vérifier la session → redirect `/auth/[ludo]` si non connecté
  - Injecter `ludo` et `currentMember` dans les locals

### Services
- [ ] `src/lib/server/services/auth.ts`
  - `verifyLudoPassword(slug, password)` → MemberRow[]
  - `createSession(ludoId, memberId)` → Session
  - `getCurrentSession(request)` → { ludo, member } | null

### DB queries
- [ ] `src/lib/server/db/ludotheques.ts`
  - `getLudoBySlug(slug)` → LudoRow | null
  - `getActiveMembersByLudo(ludoId)` → MemberRow[]

### Composants
- [ ] `src/lib/components/auth/LoginForm.svelte` — formulaire de connexion
- [ ] `src/lib/components/auth/MemberPicker.svelte` — liste de sélection du membre

## Décisions techniques
- Mot de passe commun par ludo stocké haché en bcrypt dans `ludotheques.password_hash`
- Session cookie httpOnly, 30 jours, lié à `{ ludoId, memberId }`
- Slug inexistant → `error(404, 'Ludothèque introuvable')`
- Aucun membre actif → message "Contactez votre responsable"

## Critères d'acceptation
- [ ] URL slug unique et non-modifiable
- [ ] Mauvais mot de passe → message générique (pas "mot de passe incorrect" détaillé)
- [ ] Membre désactivé → non visible dans la liste
- [ ] Session persistée 30 jours
- [ ] Slug inconnu → 404

## Playwright tests (flows critiques)
- [ ] Flow complet : `/paquis` → password → pick name → dashboard
- [ ] Mauvais password → erreur affichée
- [ ] Slug inconnu → 404
