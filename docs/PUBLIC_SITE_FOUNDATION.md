# Socle du site public

Ce document fixe les invariants du lot 1. Il complète la spécification produit sans introduire de contenu public avant les lots dédiés.

## Déploiement

1. Appliquer la migration `0002_smiling_sir_ram.sql`.
2. Déployer ensuite l'application qui lit `public_site_settings` dans le layout authentifié.
3. Activer le module ludothèque par ludothèque depuis **Site public**.

L'ancienne application reste compatible avec la migration additive. La nouvelle application suppose en revanche que la migration a déjà été appliquée. L'absence de ligne de réglage signifie que le site public est désactivé.

## Accès et activation

- Un responsable voit toujours l'entrée **Site public** afin de pouvoir activer le module.
- Un membre ne la voit et n'accède au module que lorsque celui-ci est activé pour sa ludothèque.
- L'activation exige au moins un site actif et exactement un site principal actif.
- Toute lecture et toute écriture restent filtrées par `ludo_id`.

## Publication et ciblage

- Les états éditoriaux sont `draft`, `published` et `hidden`.
- La première date de publication est conservée lors d'une republication.
- Zéro cible explicite signifie « tous les sites actifs ».
- Les futurs lecteurs publics doivent toujours joindre ou filtrer les sites actifs. Une cible devenue inactive ne doit jamais rendre du contenu visible pour ce site.
- La contrainte composite `members(id, ludo_id)` prépare les futures clés étrangères d'auteur tenant-scopées du prochain lot de contenu.

## Médias

- Les chemins sont dérivés exclusivement d'un périmètre autorisé : `public-site/{ludoId}/{domain}/{entityId}/{uuid}.{ext}`.
- L'envoi, l'enregistrement et le nettoyage utilisent le même périmètre vérifié.
- Une suppression vérifie la ludothèque, le domaine et l'entité avant de supprimer le blob.
- Les PDF utilisent l'URL de téléchargement. La signature `%PDF-` n'est qu'un contrôle de type ; tout affichage intégré futur devra ajouter une validation ou une sanitation dédiée.
- Si l'enregistrement en base échoue, le blob est supprimé. Un échec de compensation est exposé explicitement pour permettre une future outbox de nettoyage.

## Frontière du lot

Ce socle ne crée encore ni actualité, ni activité, ni document institutionnel. Les tables métier, leurs cibles et leurs routes publiques arrivent dans les lots suivants en réutilisant ces invariants.
