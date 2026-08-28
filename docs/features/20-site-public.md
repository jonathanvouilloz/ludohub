# 20 — SITE PUBLIC — Contenus, API et formulaires

> Statut : **EN COURS — socle, API et premier déploiement public réalisés**  
> Spécification canonique : `../../../website-v2/docs/PHASE-2-SPEC.md`

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
- [ ] sélections Top 3 sans catalogue de jeux ;
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
