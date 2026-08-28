# 19 — REVUE PRODUIT 2026-07 (note vocale du 22 juillet)

Mémoire de travail des **13 items** issus de la note vocale de Jonathan du 2026-07-22,
re-cadrés en live le 2026-07-30. Le backlog produit (statuts, décisions, questions) reste
dans **[../BACKLOG.md](../BACKLOG.md)** — ce fichier-ci porte l'état d'exécution, la carte
du code et les pièges.

Brut : `cerveau/10-Projets/ludo/hub/transcripts/2026-07-22_revue-produit-vocal.md`

---

## Etat session 2026-07-30

**Fait :**

- Re-cadrage complet des 13 items de la note vocale + **3 questions ouvertes tranchées**
  (swap auto-proposé à valider · domaine d'envoi gelé · double ludo = un espace, deux lieux,
  **une seule équipe**) → `docs/BACKLOG.md`, section « Précisions 2026-07-30 » + bloc Décisions.
- **Batch correctifs codé (3/3)** : bug du modal de fréquentation qui se rouvre, indisponibilités
  invisibles + modal de consultation, saisie rétroactive discrète.
- Nouvel utilitaire `src/lib/utils/new-intent.svelte.ts` — consomme `?new=1` **une seule fois par
  URL** ; remplace le `$effect` dupliqué dans `frequentation` / `games` / `supplies`.
- `DatePicker` gagne une prop `maxValue` (symétrique de `minValue`), utilisée pour borner la saisie
  rétroactive à aujourd'hui et les indisponibilités à la plage de la saison.
- Nouvelle action serveur `deleteUnavailability` sur la page saison ; le `run()` de cette page
  attrape désormais aussi `AbsenceServiceError`.

**Prochain :** faire tourner la vérification — `pnpm install` (node_modules corrompu, voir Pièges),
puis `pnpm check` + `pnpm test`, **avant** de considérer le batch livré. Ensuite : valider
visuellement les 3 correctifs sur le dev server, puis attaquer le chantier **horaires simples dans
les settings** (§9 du backlog), socle de la double ludo (§10) et du module Pâquis (§12).

**Pièges :**

- ⚠️ **`pnpm check` et `pnpm test` n'ont PAS pu être exécutés cette session.** `node_modules` est
  corrompu (paquets absents du store pnpm, ex. `kleur` → `ERR_MODULE_NOT_FOUND`) et `pnpm install`
  exige de supprimer le dossier, ce qui couperait le dev server de Jonathan. **Le batch est codé
  mais non vérifié.**
- Le bug du modal n'a pas pu être reproduit localement : **deux mécanismes** possibles (paramètre
  `?new=1` persistant parce que `replaceState` lève avant init du routeur, ou `page.url` reconstruit
  par l'`invalidateAll()` du submit). Les deux sont couverts par la garde `handledHref`. Si la
  réouverture persiste après test, c'est une **troisième** cause.
- Cause probable du « les vacances de début de saison ne marchent pas » : la liste
  `seasonAbsences` est filtrée sur la **plage de la saison** (`getApprovedAbsencesInRange`). Une
  indisponibilité saisie hors saison était bien enregistrée en base mais **invisible** dans le
  tableau. Les DatePickers sont désormais bornés à la saison.
- Déjà en place, à ne pas re-développer : l'**édition** d'une fréquentation existante (action
  `?/update` + `openEdit`), et le **multi-site** de la fréquentation (`getSitesForSlug`, colonne
  `attendance_records.site`, filtre par site, mémorisation du dernier site en `localStorage`).
  Le chantier §10 part donc de bases déjà posées côté fréquentation.

**Commit :** (à créer) `fix(planning,frequentation): batch correctifs revue produit 2026-07`

---

## Cadrage lieux et horaires — 2026-08-05

Ce lot est le prérequis direct de l'epic 20 « Site public ». Aucun code ni migration n'a été
appliqué pendant le cadrage.

### État constaté

- `ludotheques` porte encore une seule adresse et un seul jeu de coordonnées ;
- `src/lib/server/sites.ts` contient une exception codée en dur pour `paquis-secheron` ;
- `attendance_records.site` stocke une clé texte `paquis` ou `secheron` ;
- aucun modèle d'horaires récurrents n'existe en base ;
- l'UI de fréquentation sait déjà demander et mémoriser le lieu choisi.

### Modèle cible

`ludo_sites` :

- `id`, `ludo_id`, `slug`, `name` ;
- adresse, NPA, ville, téléphone, e-mail, informations d'accès ;
- latitude et longitude facultatives pour une future suggestion géographique ;
- `is_primary`, `is_active`, `sort_order`, timestamps ;
- unicité `(ludo_id, slug)`.

`site_opening_intervals` :

- `id`, `site_id`, jour de semaine ;
- heure d'ouverture et de fermeture ;
- ordre d'affichage ;
- plusieurs intervalles possibles le même jour pour gérer matin et après-midi ;
- aucune exception datée : les fermetures temporaires relèvent des annonces de l'epic 20.

### Migration prévue

1. créer un lieu principal pour chaque ludothèque à partir de ses coordonnées actuelles ;
2. créer deux lieux pour Pâquis-Sécheron ;
3. ajouter `attendance_records.site_id` nullable ;
4. convertir les valeurs texte existantes vers les UUID des lieux ;
5. adapter l'unicité fréquentation et les queries ;
6. remplacer `src/lib/server/sites.ts` par les queries DB ;
7. conserver temporairement la colonne texte uniquement pendant la transition, puis la retirer
   après vérification des données ;
8. faire exécuter la migration de production explicitement par Jonathan.

### Interface réglages

- une page « Lieux et horaires » réservée aux responsables ;
- ludo mono-site : une seule fiche, sans exposer la complexité multi-lieux ;
- Pâquis-Sécheron : deux fiches réordonnables ;
- plusieurs plages horaires par jour ;
- prévisualisation du rendu public ;
- les autres membres peuvent consulter, mais pas modifier ces réglages.

### Critères avant ouverture de l'epic 20

- [ ] chaque ludothèque possède au moins un lieu en base ;
- [ ] Pâquis-Sécheron possède exactement deux lieux actifs et stables ;
- [ ] la fréquentation référence un lieu par UUID ;
- [ ] les horaires peuvent représenter plusieurs ouvertures le même jour ;
- [ ] les responsables peuvent modifier lieux et horaires ;
- [ ] les tests couvrent isolation tenant, mono-site et multi-site ;
- [ ] la migration et son retour arrière sont documentés.

---

## Carte du code

> Mise a jour : 2026-07-30

| Fichier                                                | Role                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/lib/utils/new-intent.svelte.ts`                   | **Nouveau.** Consomme l'intention `?new=1` une seule fois par URL et nettoie l'URL. Corrige la réouverture du dialog. |
| `src/lib/components/ui/date-picker/DatePicker.svelte`  | Ajout de la prop `maxValue` (+ effet de cohérence qui efface une valeur hors borne).                    |
| `src/lib/components/frequentation/CloseSessionDialog.svelte` | Lien discret « Autre date » (état `backdating`) révélant un DatePicker borné à aujourd'hui.        |
| `src/routes/[ludo]/frequentation/+page.svelte`         | Passe par `consumeNewIntent` au lieu du `$effect` maison.                                               |
| `src/routes/[ludo]/games/+page.svelte`                 | Idem.                                                                                                    |
| `src/routes/[ludo]/supplies/+page.svelte`              | Idem.                                                                                                    |
| `src/lib/components/planning/SeasonMemberConfig.svelte` | Réécrit : liste des périodes au-dessus du formulaire d'ajout, compteur cliquable, modal de consultation, suppression, DatePickers bornés à la saison. |
| `src/lib/components/planning/SeasonWizard.svelte`      | Transmet `season` à `SeasonMemberConfig` (nécessaire pour les bornes).                                   |
| `src/routes/[ludo]/planning/saisons/[id]/+page.server.ts` | Action `deleteUnavailability` ; `run()` attrape aussi `AbsenceServiceError`.                          |

### Decisions cles

- **Une intention d'UI ne se stocke pas durablement dans l'URL.** `?new=1` est lu une fois par URL
  (garde `handledHref`), pas à chaque rafraîchissement réactif de `page`. La garde se réarme quand
  le paramètre disparaît, pour qu'un second appui sur le FAB fonctionne sans remontage du composant.
- **`replaceState` est toujours protégé par un `try/catch`** : il lève si le routeur n'est pas encore
  initialisé, et l'échec silencieux laissait le paramètre dans l'URL indéfiniment.
- **Le retour visuel d'un ajout se fait sur place**, pas via un toast seul : le panneau
  « + Indispo » reste ouvert après enregistrement et affiche la liste mise à jour juste au-dessus
  du formulaire.
- **Les bornes de saisie reflètent le filtre de lecture.** Si une liste est filtrée sur une plage,
  le picker qui l'alimente doit être borné sur la même plage — sinon on enregistre des lignes
  invisibles.
- **La saisie rétroactive reste discrète** (lien texte, pas un bouton) : c'est un rattrapage
  occasionnel, le flux normal est la séance du jour.

---

## Taches — les 13 items

### Correctifs (batch 2026-07-30)

- [x] 🐛 Modal de fréquentation qui se rouvre après validation _(§4)_
- [x] 🐛 Indisponibilités invisibles au tableau + modal « Voir les indisponibilités » _(§5)_
- [x] Saisie rétroactive discrète d'une fréquentation _(§4)_ — l'édition existait déjà
- [ ] **Vérification du batch** : `pnpm check` + `pnpm test` + validation visuelle

### Planning & absences

- [ ] Absence en cours de saison → détection des samedis assignés + **swap auto-proposé à valider** _(§5)_

### Mail / newsletter

- [ ] Pièces jointes — vérifier d'abord si déjà supporté _(§6)_
- [ ] Templates de campagne par ludo _(§6)_
- [ ] Cycle de vie complet : archivage / pagination / suppression / duplication, évolutif _(§6)_
- [ ] Tracking `delivered` — **dire d'abord si un plan Resend payant est nécessaire** _(§6)_
- [x] ~~Domaine d'envoi par ludo~~ — **gelé**, statu quo assumé _(§6)_

### Réglages, structure, auth, site public

- [ ] Horaires d'ouverture dans les settings, version simple _(§9)_
- [x] ~~Connexion Google Business Profile~~ — **reporté** hors périmètre immédiat _(§9)_
- [ ] Double ludothèque : un espace, deux lieux, une seule équipe _(§10)_ — géoloc en phase 2
- [ ] Durcir l'authentification, légèrement _(§11)_
- [ ] Module site public Pâquis-Sécheron _(§12)_ — dépend de §9 et §10
