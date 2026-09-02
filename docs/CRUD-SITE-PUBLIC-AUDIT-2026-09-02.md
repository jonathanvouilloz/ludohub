# Audit CRUD du site public — 2 septembre 2026

## Périmètre validé

Cet audit couvre le dashboard LudoHub, son API publique et le rendu de `website-v2` pour la
ludothèque `paquis-secheron`. Il distingue les contenus éditoriaux supprimables des demandes
utilisateur, qui suivent volontairement un workflow d'archivage et de rétention.

## Matrice fonctionnelle

| Rubrique                   | Création                             | Modification                                                   | Publication / workflow                                             | Suppression                                                       | Médias                                                   |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------- |
| Lieux et horaires          | Oui                                  | Oui, horaires compris                                          | Activation, lieu principal, ordre public                           | Oui, seulement si le lieu est masqué, non principal et inutilisé  | Sans objet                                               |
| Annonces                   | Oui                                  | Oui                                                            | Activer / masquer                                                  | Oui après désactivation                                           | Texte court, sans image par conception                   |
| Actualités                 | Oui                                  | Oui, avec adresse stable après première publication            | Publier / masquer                                                  | Oui après masquage                                                | Image principale, image de contenu et pièces jointes PDF |
| Activités                  | Oui                                  | Oui, dates, récurrence et exceptions comprises                 | Publier / masquer, mettre en avant, archiver, restaurer, corbeille | Oui depuis la corbeille                                           | Image principale, image de contenu et pièces jointes PDF |
| Inscriptions aux activités | Oui depuis le formulaire public      | Les données personnelles ne sont pas éditées dans le dashboard | Reçue, attente, confirmée, refusée, annulée, archivée              | Pas de suppression manuelle : archivage et politique de rétention | Sans objet                                               |
| Top 3                      | Oui, exactement trois jeux           | Oui                                                            | Publier / masquer, sélectionner pour l'accueil                     | Oui après masquage                                                | Une image et un texte alternatif par jeu                 |
| Équipe et comité           | Oui                                  | Oui                                                            | Publier / masquer                                                  | Oui après masquage                                                | Photo et texte alternatif par profil                     |
| Galerie                    | Oui                                  | Oui                                                            | Publier / masquer                                                  | Oui après masquage                                                | Image et texte alternatif                                |
| FAQ                        | Oui                                  | Oui                                                            | Publier / masquer                                                  | Oui après masquage                                                | Sans objet                                               |
| Documents                  | Oui                                  | Oui                                                            | Publier / masquer                                                  | Oui après masquage                                                | Fichier PDF                                              |
| Annuaire                   | Oui                                  | Oui                                                            | Publier / masquer                                                  | Oui après masquage                                                | Sans objet                                               |
| Contacts                   | Création depuis le formulaire public | Pas d'édition du message reçu                                  | Nouveau, traité, archivé                                           | Pas de suppression manuelle                                       | Sans objet                                               |

## Correctifs apportés pendant l'audit

- Les pages imbriquées des actualités (`nouveau`, fiche et modification) exposent maintenant les
  actions de formulaire attendues. Les formulaires utilisent des actions locales stables, ce qui
  supprime les réponses 404 observées lors de la création, de la modification et des médias.
- Une actualité brouillon ou masquée peut être supprimée depuis sa fiche ; ses médias sont nettoyés.
- Une annonce inactive peut être supprimée depuis sa liste.
- Un lieu masqué, non principal et sans référence peut être supprimé.
- Les suppressions d'actualités et d'annonces utilisent la révision affichée : une page ancienne ne
  peut pas effacer une version modifiée entre-temps.
- Chaque jeu d'un Top 3 accepte maintenant une image JPEG, PNG ou WebP de 5 Mio maximum, avec texte
  alternatif obligatoire. Le remplacement et le retrait nettoient l'ancien fichier.
- L'API publique expose les images des Top 3 sans divulguer leur clé de stockage interne.
- `website-v2` affiche les images du Top 3 sur l'accueil et sur la page de sélection, avec un visuel
  de repli lorsque l'image est absente.
- Les photos d'équipe existaient déjà de bout en bout et ont été revérifiées : ajout, remplacement,
  retrait, nettoyage, projection API et rendu sur la page Équipe.
- En développement local, les images et PDF sont stockés sous `static/public-site/` et servis par
  LudoHub. La production continue d'utiliser Vercel Blob ; une configuration Blob invalide produit
  maintenant une erreur métier lisible au lieu d'une page 500.
- L'autorisation CORS des formulaires publics lit correctement `PUBLIC_API_ALLOWED_ORIGINS` depuis
  l'environnement public SvelteKit, tout en acceptant la nouvelle clé privée `API_ALLOWED_ORIGINS`.
- Une activité placée dans la corbeille expose maintenant son bouton de suppression définitive.
- Après publication puis masquage, les actualités, Top 3, profils, photos, FAQ, documents et entrées
  d'annuaire redeviennent supprimables. Un contenu encore public reste protégé.
- La garde de suppression en base a été alignée sur cette règle pour les Top 3, profils, photos de
  galerie, FAQ, documents et entrées d'annuaire : tout contenu non publié peut être supprimé. Cela
  élimine le faux conflit « modifié simultanément » observé après le masquage d'un contenu avec média.

## Parcours connectés rejoués dans le navigateur

- Actualité : création, modification, couverture, image de contenu, PDF, remplacement/retrait,
  publication, rendu de la fiche publique, masquage et suppression réussis.
- Activité : création avec date, modification, couverture, réglages d'inscription, publication,
  rendu public, demande d'inscription, passage `Reçue → Confirmée → Archivée`, masquage et corbeille.
- Annonce : création, modification, activation, affichage sur l'accueil public et désactivation.
- Top 3 : création des trois jeux, modification, ajout d'une image de jeu, publication, rendu public
  et masquage.
- Galerie : création, ajout d'image, modification, publication, rendu public et masquage.
- Équipe : création d'un profil, ajout de photo, modification, publication, rendu public et masquage.
- Documents : création, ajout de PDF, modification, publication, rendu public et masquage.
- FAQ : création, modification, publication, rendu public et masquage.
- Annuaire : création, modification, publication, rendu public et masquage.
- Lieux : création d'un lieu de test non public et modification de ses coordonnées.
- Contacts : envoi d'un message depuis le formulaire public, réception dans le dashboard et
  archivage réussis.

## Preuves de vérification

- Dashboard : 96 fichiers de tests et 654 tests réussis.
- Site public v2 : 13 fichiers de tests et 125 tests réussis.
- `svelte-check` : 0 erreur, 0 avertissement.
- `astro check` : 0 erreur, 0 avertissement, 0 indication.
- Tous les fichiers source modifiés passent Prettier et ESLint.
- Migration SQL `0016_safe_firebrand.sql` appliquée avec succès.
- Les 11 routes API publiques (lieux, annonces, actualités, activités, archives, Top 3, FAQ,
  documents, galerie, profils et annuaire) répondent en HTTP 200 sur le serveur local relié à la
  base configurée.
- Les actions imbriquées création/modification/image d'actualité, publication d'activité et statut
  d'inscription sont atteignables : sans session, chacune renvoie l'enveloppe de redirection 303
  vers la connexion, et aucune ne renvoie 404.
- Les pages publiques accueil, actualités, activités, Top 3, équipe, documents, FAQ et annuaire,
  ainsi que les fiches d'actualité et d'activité existantes, répondent en HTTP 200 sans erreur de
  rendu.
- Le build Vercel complet de `website-v2` réussit. Le build SvelteKit du dashboard compile toutes
  les routes ; seul l'emballage local de l'adaptateur Vercel échoue sous Windows lors de la création
  d'un lien symbolique. Le runbook du projet documente déjà cette contrainte Windows et impose le
  build Linux Vercel comme preuve finale du packaging.

## Nettoyage final

- Tous les contenus temporaires `TEST CRUD` ont été supprimés, avec leurs images et PDF. L'activité
  supprimée a également nettoyé son inscription archivée. Le message de contact de validation est
  conservé au statut `Archivé`, conformément à la politique de rétention.
- Le lieu temporaire inactif a été supprimé.
- Le dossier obsolète `website-v2-lot8`, y compris ses quatre modifications locales non commitées, a
  été supprimé définitivement après confirmation explicite. `website`, `samediLudoV2`, `ludoOrphee`
  et `ludoOrphee-lot9` n'ont pas été touchés.
