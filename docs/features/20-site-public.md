# 20 — SITE PUBLIC — Contenus, API et formulaires

> Statut : **EN COURS — socle, API et premier déploiement public réalisés**  
> Spécification canonique : `../../../website-v2/docs/PHASE-2-SPEC.md`

> Plan de simplification validé le 23 septembre 2026 :
> [20-site-public-simplification.md](20-site-public-simplification.md)

## État session 2026-09-18

**Fait :**

- Édition des Top 3 refondue : le modal `TopThreeDialog.svelte` (supprimé) laisse place à trois écrans
  plats — liste, `top-3/nouveau`, `top-3/[id]` — alimentés par `TopThreeForm.svelte`, sur le pattern
  déjà en place pour les actualités.
- Un Top 3 se crée avec son nom, ses trois jeux **et leurs trois photos en un seul enregistrement**
  (compression navigateur via `compressEditorialImageFields`), orchestré par
  `src/lib/server/public-top-three-form.ts` qui propage la révision CAS à chaque écriture.
- Simplifications assumées côté staff : slug dérivé du nom (suffixé s'il est pris), ciblage toujours
  « tous les lieux actifs », texte alternatif déduit du nom du jeu, cycle brouillon → publié → masqué
  retiré de l'écran (création publiée d'emblée, retrait = suppression).
- « Sur la page d'accueil » devient une case du formulaire ; la sélection atomique existante retire
  automatiquement l'ancienne.
- Tests : `top-3/page-server.test.ts` et `page-ui.test.ts` réécrits, `nouveau/` et `[id]/` ajoutés,
  service et couche db complétés (slug auto, insertion publiée, projection des slugs) →
  `pnpm test` 674 ✅, `pnpm check` 0 erreur ✅.

**Prochain :** continuer le nettoyage de la section « Site public » sur Pâquis-Sécheron — Jonathan
désigne le prochain écran jugé trop complexe (candidats : `annonces`, `activites`, `galerie`,
`profils`), même méthode que les Top 3 : un formulaire plat, une seule soumission, pas d'état à
comprendre.

**Pièges :**

- `pnpm build` échoue localement sur `EPERM: symlink` dans l'adapter Vercel (droits Windows) —
  préexistant ; la compile et l'analyse des routes passent avant cette étape.
- `pnpm lint` global remonte des milliers d'issues venant de `.vercel/output`, absent des `ignores`
  d'`eslint.config.js` : le lint utile se fait en ciblant les fichiers touchés.
- Les Top 3 hérités encore `draft`/`hidden` n'ont plus de bouton Publier : l'action `update` les met
  en ligne au premier enregistrement (tâche @jon posée dans le cerveau).
- `hidePublicTopThree` et `deleteDraftPublicTopThree` restent dans le service sans appelant UI (API du
  cycle éditorial, couverte par les tests) — ne pas les supprimer en croyant à du code mort.

**Commit :** `736693b` feat(site-public): simplify top three editing

---

## Carte du code

> Mise à jour : 2026-09-18 — chaîne Top 3 (le reste de l'epic 20 n'est pas encore cartographié)

| Fichier | Rôle |
|---------|------|
| `src/routes/[ludo]/site-public/top-3/+page.server.ts` | Liste des Top 3 du tenant + unique action `delete` (CAS, nettoyage Blob) |
| `src/routes/[ludo]/site-public/top-3/+page.svelte` | Cartes en lecture : nom, badge accueil, 3 vignettes, Modifier / Supprimer |
| `src/routes/[ludo]/site-public/top-3/nouveau/+page.server.ts` | Action `create` : création publiée, photos, accueil, audits |
| `src/routes/[ludo]/site-public/top-3/[id]/+page.server.ts` | Action `update` : texte → photos → publication des lignes héritées → accueil |
| `src/lib/components/public-site/TopThreeForm.svelte` | Formulaire unique partagé (nom, 3 jeux + photo, case accueil), aperçu local et compression |
| `src/lib/server/public-top-three-form.ts` | Garde de contexte, lecture du formulaire, enchaînement des photos avec propagation de révision, bascule accueil, audit |
| `src/lib/server/services/public-top-threes.ts` | Métier : slug dérivé, insertion directe en `published`, CAS, médias, lecture publique |
| `src/lib/server/db/public-top-threes.ts` | Queries Drizzle, dont `listPublicTopThreeSlugRows` pour désambiguïser le slug |
| `src/lib/media/editorial-image.ts` | `compressEditorialImageFields` : compresse plusieurs champs image d'un même envoi |

### Décisions clés

- Le contrat public est intact : l'API `/api/public/v1/[ludo]/top-threes(/[slug])` continue de lire le
  slug et les lignes `published`. Le slug reste immuable après publication, donc renommer un Top 3 ne
  casse pas son URL publique.
- Aucune migration : les contraintes autorisent déjà l'insertion en `published` (`publishedAt` +
  `publishedByMemberId`) et `is_homepage` n'exige que `status = 'published'`.
- Le ciblage par lieu reste en base et est préservé à la mise à jour (`targetMode` absent) : les Top 3
  déjà ciblés gardent leur ciblage, les nouveaux visent tous les lieux actifs.
- Chaque écriture incrémente `revision` : toute séquence (texte → photos → publication → accueil) doit
  réutiliser la révision retournée par l'étape précédente, sinon CAS en échec.

---

## Objectif

Ajouter à LudoHub un module de gestion et d'exposition des contenus publics, d'abord activé pour
Pâquis-Sécheron mais conçu comme une capacité multi-tenant. Le site Astro reste un client en
lecture ; LudoHub demeure le back-office et la source de vérité.

## Prérequis bloquants

- [ ] vérifier le batch de correctifs de l'epic 19 ;
- [x] stabiliser le modèle `ludothèque → N lieux` selon le cadrage ajouté à l'epic 19 le
  5 août 2026 ;
- [ ] terminer les horaires par lieu (Pâquis et Sécheron restent à renseigner dans LudoHub) ;
- [x] définir des identifiants de lieux stables consommables par les contenus publics.

## État du 16 août 2026

- Les lieux actifs `paquis` et `secheron` sont présents dans Neon ; `paquis` est le lieu principal.
- Les responsables peuvent créer un lieu depuis « Lieux et horaires ».
- Le site Astro est rendu à la demande sur Vercel : lieux et horaires sont lus depuis l'API
  LudoHub à chaque requête, sans nouveau déploiement.

## Périmètre fonctionnel

- [ ] flag d'activation du module par ludothèque ;
- [ ] annonces de service activées/désactivées manuellement et ciblées par lieu ;
- [ ] actualités avec brouillon/publication/masquage ;
- [ ] activités ponctuelles, récurrentes ou permanentes, exceptions, archives et corbeille ;
- [ ] inscriptions publiques facultatives aux activités, sans compte ;
- [x] sélections Top 3 sans catalogue de jeux ;
- [ ] galerie simple ;
- [ ] profils publics séparés, lien facultatif vers `members` ;
- [ ] FAQ, documents institutionnels et rapports ;
- [ ] messages de contact stockés et notifiés par e-mail ;
- [ ] formulaire d'adhésion public mutualisé par ludothèque ;
- [ ] API publique en lecture seule, versionnée et strictement filtrée ;
- [ ] audit des actions éditoriales via le dispatcher existant.

## Permissions

- tous les membres actifs gèrent les contenus éditoriaux ;
- les responsables seuls gèrent règlements, formulaires d'adhésion et inscriptions ;
- les routes publiques de lecture n'exposent jamais les membres internes ni les données de
  formulaires.

## Modèle éditorial commun

Les contenus publiables réutilisent des primitives cohérentes :

- `ludoId` obligatoire ;
- ciblage optionnel vers un ou plusieurs lieux ;
- statut explicite (`draft`, `published`, `hidden`, avec `archived`/`trashed` selon le domaine) ;
- `publishedAt`, auteur et dates de création/mise à jour ;
- ordre manuel uniquement quand le produit le demande ;
- suppression Blob coordonnée avec la suppression définitive de l'entité.

Ne pas imposer une table générique de contenus si elle complique les contraintes propres à chaque
domaine. Mutualiser les types, permissions et helpers, pas nécessairement toutes les tables.

## Contrat public

- préfixe versionné, par exemple `/api/public/v1/...` ;
- résolution par slug de ludothèque et slug/clé de lieu ;
- seules les lignes publiées ou actives sont sérialisées ;
- réponses typées avec dates ISO et URLs absolues ;
- CORS limité aux origines configurées ;
- cache HTTP explicite et stratégie de repli côté site ;
- aucune mutation éditoriale par cette API.

## Médias

Réutiliser Vercel Blob et la compression déjà en place pour les thèmes. Prévoir des préfixes par
ludothèque et domaine (`public-site/{ludoId}/activities/...`) ainsi qu'un nettoyage fiable à la
suppression. Les photos publiques utilisent un store public ; les éventuels documents sensibles
utilisent un accès privé ou restent hors Blob public.

## Formulaire d'adhésion

Page publique propre à chaque ludothèque, intégrable ou partageable par QR code. Champs, acceptation
et cycle de conservation définis dans la spécification canonique. Hypothèse initiale : suppression
automatique 30 jours après traitement, configurable et à confirmer.

L'extension Orphée consomme une API authentifiée dédiée, distincte de l'API publique de contenu.

## Stratégie de livraison

1. fondations et schéma commun après stabilisation des lieux ;
2. annonces + horaires + API minimale ;
3. actualités, activités et Top 3 ;
4. galerie, profils, FAQ, documents et contacts ;
5. inscriptions aux activités ;
6. formulaire d'adhésion et API extension Orphée.

Chaque incrément doit inclure services, queries Drizzle, permissions, tests unitaires et routes
minces conformes aux conventions du projet.

## Critères de sortie du premier lot

- [ ] module activable sans effet sur les autres ludothèques ;
- [ ] cloisonnement multi-tenant testé ;
- [ ] ciblage Pâquis/Sécheron/deux lieux testé ;
- [ ] premier contenu publiable avec brouillon et publication ;
- [ ] première route publique versionnée consommable par `website-v2` ;
- [ ] documentation du contrat et des états de repli.
