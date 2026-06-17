---
project: LudoHub
type: app
stack: sveltekit-neon
rigor: standard
version: 1.0.0
date: 2026-06-15
status: draft
dev_server: manual
---

# PRD — LudoHub

## Plateforme multi-ludothèque pour les ludothèques de Genève

---

## Contexte

Les ludothèques de Genève (12 au total, gérées par la FASE) gèrent leur planning, absences, thèmes et inventaire de manière isolée. Il n'existe pas d'outil commun. Le partage de thèmes (caissettes) entre ludothèques se fait manuellement par téléphone ou WhatsApp. Les remplacements entre ludos se coordonnent par email.

Un premier outil (`samediLudoV2`) existe pour la Ludothèque des Pâquis-Sécheron, mais il est single-tenant avec une auth localStorage — non scalable. LudoHub en est la refonte from scratch, multi-tenant dès la base.

---

## Problème

- Chaque ludothèque gère son planning en silo, sans outil commun
- Le partage de thèmes (caissettes) entre ludos est manuel et non traçable
- Les demandes de remplacement passent par WhatsApp/email
- Aucun outil commun ne permet la coordination entre ludos genevois

## Solution

Une plateforme web multi-tenant où chaque ludothèque a son espace propre, ses membres, son planning — et où les thèmes peuvent être partagés et empruntés entre ludos. Un système de demandes d'aide cross-ludo remplace les échanges WhatsApp.

---

## Utilisateurs

**Membre (utilisateur principal)**
Staff d'une ludothèque. Peu technique. Utilise l'app depuis un ordinateur au bureau ou un smartphone. Veut voir son planning rapidement, soumettre une absence, consulter les thèmes disponibles.

**Responsable**
Membre avec droits étendus. Approuve les absences, gère les membres, administre la saison de planning. Peut prêter des thèmes au nom de la ludo.

**Super Admin (Jonathan)**
Crée et configure les ludothèques initiales. Accès global pour debug. Les ludos sont créées manuellement (nombre limité et connu à l'avance).

## Métrique de succès

2+ ludothèques genevoises actives sur la plateforme avec du partage de thèmes effectif entre elles.

---

## Scope MVP

### Features IN

| Feature                    | Description                                                     | Source         |
| -------------------------- | --------------------------------------------------------------- | -------------- |
| Multi-tenant + Auth        | URL slug par ludo + mot de passe commun + sélection du nom      | Nouveau        |
| Gestion membres            | CRUD, rôles responsable/membre, désactivation                   | Port+          |
| Planning samedis           | Saisons, shifts, assignations, swap                             | Port           |
| Absences / Congés          | Demande par membre, approbation par responsable                 | Port           |
| Thèmes                     | Items, photos (Vercel Blob, 3 max), prêts push/pull entre ludos | Port+          |
| Demandes d'aide cross-ludo | Feed visible par toutes les ludos, réponse volontaire           | Nouveau        |
| Wishlist jeux              | Ajouter un jeu, marquer comme acheté                            | Port           |
| Demandes de matériel       | Lister les besoins, statut commandé/reçu                        | Port simplifié |
| Logs d'activité            | Audit trail par ludo                                            | Port           |

### Features OUT (V2)

- Inventaire complet du matériel
- Actualités rapides push vers le site web
- Demande formelle de thème (le prêt direct suffit)
- Notifications email/push
- Export planning PDF
- Onboarding autonome d'une nouvelle ludo

---

## User Stories

### AUTH — Connexion à une ludothèque

**En tant que** membre de la ludo Pâquis **je veux** accéder à l'app via l'URL de ma ludo **afin de** m'identifier sans créer de compte individuel.

**Flow :**

1. Accès à `ludohub.ch/paquis`
2. Page de connexion avec le nom et la couleur de la ludo Pâquis
3. Saisie du mot de passe commun de la ludo
4. Sélection de son nom dans la liste des membres actifs
5. Accès au dashboard

**Critères d'acceptation :**

- [ ] URL slug unique et non-modifiable par ludo
- [ ] Mot de passe haché en base (bcrypt via Better Auth)
- [ ] Session persistée (cookie httpOnly, 30 jours)
- [ ] Mauvais mot de passe → message d'erreur générique sans indication
- [ ] Membre désactivé → non visible dans la liste de sélection

**Edge cases :**

- Slug inexistant → 404 avec message "Ludothèque introuvable"
- Aucun membre actif → message "Contactez votre responsable"

---

### MEMBRES — Gestion de l'équipe

**En tant que** responsable **je veux** gérer les membres de mon équipe **afin de** maintenir la liste à jour.

**Flow :**

1. Section Paramètres → Membres
2. Ajouter un membre (nom + rôle)
3. Modifier le nom ou le rôle
4. Désactiver un membre (n'apparaît plus dans la sélection de connexion)
5. Supprimer un membre (uniquement si aucune assignation existante)

**Critères d'acceptation :**

- [ ] Rôles : membre / responsable
- [ ] Désactivation non-destructive (historique préservé)
- [ ] Suppression bloquée si des assignations ou absences existent

---

### PLANNING — Samedis

**En tant que** responsable **je veux** gérer le planning des samedis de la saison **afin d'** organiser les présences de l'équipe.

**Flow :**

1. Créer une saison (nom, date début, date fin)
2. Les samedis sont générés automatiquement dans la saison
3. Configurer le nombre de membres requis par samedi
4. Assigner des membres à chaque samedi
5. Swap possible entre deux membres via dialog de confirmation

**Vue membre :** liste de ses prochains samedis assignés.
**Vue responsable :** grille complète avec tous les membres par samedi.

**Critères d'acceptation :**

- [ ] Génération auto des samedis entre start_date et end_date
- [ ] Impossible d'assigner un membre deux fois sur le même slot
- [ ] Swap : sélectionner deux membres → confirmation → échange
- [ ] Saison archivée en fin de période (non-supprimée)

**Edge cases :**

- Samedi férié : responsable peut marquer le slot comme "annulé"
- Membre absent ce jour-là : warning visuel si assigné malgré une absence approuvée

---

### ABSENCES — Demande et approbation

**En tant que** membre **je veux** soumettre une demande d'absence **afin d'** informer ma responsable de mon indisponibilité.

**Flow :**

1. "Nouvelle demande" depuis le dashboard ou la section Absences
2. Choisir le type (congé / vacances / formation / indisponible)
3. Sélectionner la période (date début → date fin)
4. Ajouter une note optionnelle
5. Soumettre → statut "En attente"
6. Responsable : voir les demandes en attente → approuver ou refuser avec note

**Critères d'acceptation :**

- [ ] Types : congé / vacances / formation / indisponible
- [ ] Statuts : en_attente / approuvé / refusé
- [ ] Responsable voit toutes les demandes de sa ludo
- [ ] Membre voit uniquement ses propres demandes + statut + note de réponse
- [ ] Absences approuvées visibles dans la vue planning (warning si conflit)

---

### THÈMES — Catalogue, partage et prêts

**En tant que** membre **je veux** gérer les thèmes de ma ludo et consulter ceux disponibles dans le réseau **afin de** trouver du contenu pour nos activités.

**Flow — Créer un thème :**

1. Nouveau thème → nom + description
2. Ajouter des items (nom + quantité)
3. Ajouter jusqu'à 3 photos (upload → Vercel Blob)
4. Cocher "Partager dans le réseau" pour le rendre visible aux autres ludos

**Flow — Prêter (push) :**

1. Ouvrir un thème de ma ludo → "Prêter à une ludo"
2. Sélectionner la ludo destinataire
3. Note optionnelle → Confirmer
4. Thème marqué "En prêt chez [ludo]"

**Flow — Emprunter (pull) :**

1. Section "Réseau" → Thèmes disponibles (tous les thèmes `is_shareable: true` des autres ludos)
2. "Demander ce thème" → notification pour la ludo propriétaire
3. Propriétaire confirme → prêt actif

**Critères d'acceptation :**

- [ ] Upload photos : max 3, formats jpg/png/webp, max 5MB chacune
- [ ] Un thème ne peut pas être prêté si un prêt actif existe déjà
- [ ] Historique des prêts visible sur la fiche thème
- [ ] Thèmes archivables (items hors service)

---

### THÈMES — Installations & check-ups *(epic 13, à faire)*

**En tant que** membre **je veux** suivre ce qui est réellement sorti d'un thème et le contrôler chaque jour **afin de** ne rien perdre du matériel mis à disposition.

> **Contexte métier.** `theme_items` est la **liste de référence complète** du thème (tout le contenu de la grosse caisse plastique). Quand on **installe** un thème pour une animation, on ne sort pas tout : on choisit un **sous-ensemble** (~70-80 %). Les **check-ups quotidiens** portent uniquement sur ce sous-ensemble installé (ce qui circule) ; ce qui reste dans la caisse ne bouge pas et n'est pas contrôlé.

**Flow — Installer :**

1. Fiche thème → "Installer dans la ludo" (bloqué si une installation est déjà en cours)
2. Cocher le sous-ensemble d'items sortis + note optionnelle → Confirmer
3. Installation datée et historisée (qui, quand, quels items)

**Flow — Check-up quotidien :**

1. Sur l'installation en cours → "Nouveau check-up"
2. Pour chaque item installé : label `Nom (×quantité)` + toggle présent / manquant
3. Enregistrer → check-up daté + historique consultable

**Flow — Clôturer :** remise en caisse → installation `cloturee`, historique figé.

**Critères d'acceptation :**

- [ ] Une seule installation active par thème
- [ ] Sous-ensemble (≥1 item) daté et historisé
- [ ] Check-up présent/manquant par item installé, quantité affichée dans le label
- [ ] Les items restés en caisse n'apparaissent pas dans les check-ups
- [ ] Historique des installations et check-ups consultable

> Détail complet : `docs/features/13-themes-checkup.md`.

---

### DEMANDES D'AIDE — Remplacements cross-ludo

**En tant que** membre de Pâquis **je veux** publier une demande de remplacement **afin de** trouver rapidement quelqu'un d'une autre ludo disponible.

**Flow :**

1. "Nouvelle demande d'aide" → date + créneau + note descriptive
2. Demande publiée dans le feed cross-ludo, visible par tous
3. Un membre d'une autre ludo clique "Je suis disponible"
4. La ludo demandeuse voit les réponses et confirme un volontaire
5. Demande marquée "Pourvue"

**Critères d'acceptation :**

- [ ] Feed cross-ludo visible par tous les membres de toutes les ludos
- [ ] Demandes passées filtrables / archivables
- [ ] Statuts : ouverte / pourvue / annulée
- [ ] Identité du volontaire + sa ludo affichée dans la réponse

---

### WISHLIST JEUX

**En tant que** membre **je veux** noter des jeux à acheter **afin de** centraliser les souhaits d'acquisition.

**Flow :**

1. Ajouter un jeu (titre + lien optionnel + prix CHF estimé)
2. Liste visible par tous les membres de la ludo
3. Marquer comme "Acheté" avec le nom de l'acheteur

**Critères d'acceptation :**

- [ ] Jeux achetés déplacés en bas de liste ou section dédiée
- [ ] Lien externe cliquable
- [ ] Prix CHF optionnel

---

### DEMANDES DE MATÉRIEL

**En tant que** membre **je veux** signaler un besoin en matériel ou fournitures **afin de** centraliser les demandes.

**Flow :**

1. Ajouter une demande (nom + catégorie + urgence + note)
2. Liste visible par la ludo
3. Responsable marque comme "Commandé" puis "Reçu"

**Critères d'acceptation :**

- [ ] Catégories : jeux / matériel / fournitures / autre
- [ ] Urgence : normale / haute / critique
- [ ] Statuts : en_attente / commandé / reçu

---

## Data Model

```sql
-- Core multi-tenant
ludotheques     (id, name, slug, password_hash, color, address, created_at)
members         (id, ludo_id, name, role, is_active, created_at)

-- Planning
seasons         (id, ludo_id, name, start_date, end_date, created_at)
saturday_slots  (id, season_id, date, type, required_count, is_cancelled)
assignments     (id, slot_id, member_id, UNIQUE(slot_id, member_id))

-- Absences
absences        (id, ludo_id, member_id, type, start_date, end_date,
                 status, notes, responder_notes, responded_by, created_at)

-- Thèmes
themes          (id, owner_ludo_id, name, description, is_shareable,
                 is_archived, created_at)
theme_items     (id, theme_id, name, quantity, is_archived)
theme_images    (id, theme_id, url, storage_key, created_at)
theme_loans     (id, theme_id, from_ludo_id, to_ludo_id,
                 status, notes, created_at)

-- Thèmes : installations & check-ups (epic 13, à faire)
theme_installations      (id, theme_id, ludo_id, installed_by_member_id,
                          installed_at, closed_at, status, notes, created_at)
theme_installation_items (id, installation_id, theme_item_id)
theme_checkups           (id, installation_id, checked_by_member_id,
                          checked_at, notes, created_at)
theme_checkup_items      (id, checkup_id, installation_item_id, status, note)

-- Cross-ludo
help_requests   (id, ludo_id, date, slot_info, notes, status, created_at)
help_responses  (id, help_request_id, member_id, ludo_id, status, created_at)

-- Interne ludo
game_wishes     (id, ludo_id, title, link, price_chf, status,
                 buyer_id, created_at)
supply_requests (id, ludo_id, member_id, name, category, urgency,
                 status, notes, created_at)

-- Audit
activity_log    (id, ludo_id, member_id, action, entity_type,
                 entity_id, metadata, created_at)
```

**Relations clés :**

- `members.ludo_id` → `ludotheques.id`
- `seasons.ludo_id` → `ludotheques.id`
- `saturday_slots.season_id` → `seasons.id`
- `assignments.slot_id` → `saturday_slots.id`
- `assignments.member_id` → `members.id`
- `theme_loans.from_ludo_id` + `to_ludo_id` → `ludotheques.id`
- `help_responses.member_id` → `members.id` (cross-ludo intentionnel)
- `game_wishes.buyer_id` → `members.id` (nullable)

---

## Stack Technique

```
Framework :     SvelteKit 2 (SSR + API routes)
Database :      Neon (Postgres serverless) + Drizzle ORM
Auth :          Better Auth (session cookie, password partagé par ludo)
Hosting :       Vercel
Styling :       Tailwind CSS v4 + shadcn-svelte
Storage :       Vercel Blob (images thèmes, 3 max/thème)
Tests :         Vitest (unit/services) + Playwright (flows critiques)
CI :            GitHub Actions (lint + typecheck + tests sur PR)
```

**Variables d'environnement nécessaires :**

```
DATABASE_URL=           # Neon connection string
BETTER_AUTH_SECRET=     # Secret session Better Auth
BLOB_READ_WRITE_TOKEN=  # Vercel Blob
PUBLIC_APP_URL=         # https://ludohub.ch (ou vercel preview)
SUPER_ADMIN_PASSWORD=   # Mot de passe admin Jonathan
```

---

## Architecture

Projet M+ — 15 entités, logique métier réutilisée entre routes.

```
src/
├── lib/
│   ├── server/
│   │   ├── db/                  ← queries Drizzle (par domaine)
│   │   │   ├── ludotheques.ts
│   │   │   ├── members.ts
│   │   │   ├── planning.ts
│   │   │   ├── themes.ts
│   │   │   ├── absences.ts
│   │   │   └── ...
│   │   ├── services/            ← logique métier
│   │   │   ├── planning.ts      (génération samedis, swap, conflits)
│   │   │   ├── themes.ts        (prêts, upload Vercel Blob, partage)
│   │   │   ├── absences.ts      (workflow approbation, conflits planning)
│   │   │   └── help.ts          (demandes cross-ludo)
│   │   ├── auth.ts              ← Better Auth config (password ludo + session)
│   │   └── schema.ts            ← Drizzle schema complet
│   ├── components/              ← composants Svelte partagés
│   │   ├── ui/                  (shadcn-svelte)
│   │   ├── planning/
│   │   ├── themes/
│   │   └── ...
│   └── utils/
│       ├── dates.ts             (calcul samedis, formatage CH)
│       └── permissions.ts       (guards responsable/membre)
├── routes/
│   ├── [ludo]/                  ← scope par ludo (auth middleware)
│   │   ├── +layout.server.ts    (vérifie slug + session valide)
│   │   ├── +page.svelte         (dashboard ludo)
│   │   ├── planning/
│   │   ├── absences/
│   │   ├── themes/
│   │   ├── games/
│   │   ├── supplies/
│   │   └── settings/            (responsable uniquement)
│   ├── reseau/                  ← cross-ludo (thèmes partagés + aide)
│   │   ├── themes/              (catalogue réseau)
│   │   └── aide/                (demandes de remplacement)
│   ├── admin/                   ← super admin (Jonathan)
│   │   ├── ludotheques/         (CRUD ludos)
│   │   └── logs/
│   └── auth/
│       └── [ludo]/              (page de connexion par slug)
└── app.html
```

**Règle architecture :** `+page.server.ts` = orchestration uniquement. Logique métier dans `services/`. Queries DB dans `db/`.

---

## Design Intent

**Référence principale :** Tipee (outil RH que les ludos utilisent déjà via la FASE) — même DNA visuel, adapté pour être plus chaleureux et ludique.

**Palette de couleurs :**

| Token            | Valeur    | Usage                                  |
| ---------------- | --------- | -------------------------------------- |
| `--bg-base`      | `#EEF2F8` | Fond général gris bleuté               |
| `--bg-card`      | `#FFFFFF` | Cartes blanches                        |
| `--bg-sidebar`   | `#F1F5FA` | Sidebar                                |
| `--primary`      | `#0073E6` | Navigation, liens, actions secondaires |
| `--primary-dark` | `#005BA8` | Bouton actif, hover                    |
| `--accent`       | `#C0007A` | Actions principales (CTA)              |
| `--text-main`    | `#25324B` | Texte principal                        |
| `--text-muted`   | `#68758E` | Labels, secondaire                     |
| `--danger`       | `#F02849` | Badges notification, erreurs           |

**Couleur par ludothèque :** chaque ludo a une couleur d'accent stockée en DB. Utilisée dans le header de connexion et un dot d'identification dans le feed cross-ludo.

**Typographie :** Nunito (Google Fonts) — arrondie, douce, lisible. Proche de SF Pro Rounded. Poids 400/500/700.

**Layout :**

- Sidebar verticale étroite (~72px) avec icônes + labels 12px
- Contenu principal en cartes blanches `border-radius: 16-20px`
- Fond gris bleuté permet aux cartes de ressortir sans ombre forte
- Boutons en pill shape (`border-radius: 999px`)
- Ombres légères : `box-shadow: 0 8px 24px rgba(30, 50, 80, 0.08)`

**Animations :** 5/10 — transitions de page fluides (150ms ease), micro-interactions sur boutons et cards, pas d'animations lourdes.

**Mode :** Light uniquement.

**Non-techniques à retenir :** les utilisateurs sont peu techniques. Favoriser des actions claires, des états vides explicatifs, des confirmations avant suppression, des labels en français simple.

---

## Dev Preferences

```
dev_server: manual
```

Jonathan teste lui-même en gardant un serveur actif. Claude ne lance pas le serveur pour valider.

**Flows critiques à couvrir avec Playwright :**

- [ ] Connexion à une ludo (slug → password → pick name → dashboard)
- [ ] Créer une saison et assigner un membre à un samedi
- [ ] Soumettre une absence + approbation par responsable
- [ ] Prêter un thème à une autre ludo (push)
- [ ] Poster une demande d'aide cross-ludo + répondre depuis une autre ludo

---

## Post-Init Checklist

Après avoir sauvegardé ce fichier en `docs/PRD.md` dans le nouveau projet :

- [ ] `/boot-project` — orchestre init-project + init-design en une commande
- [ ] Créer le projet Neon → récupérer `DATABASE_URL`
- [ ] Configurer Vercel Blob → `BLOB_READ_WRITE_TOKEN`
- [ ] Créer le repo GitHub + lier à Vercel
- [ ] `/init-identity` — identité de la plateforme (nom, positionnement)
- [ ] `/init-moodboard` — si génération d'assets visuels prévue
