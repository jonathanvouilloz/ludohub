# Migration multi-lieu

Cette migration est additive : elle crée `ludo_sites` et `site_opening_intervals`, puis ajoute
`attendance_records.site_id` sans supprimer le champ historique `attendance_records.site`.

## Déploiement contrôlé

1. Restaurer une sauvegarde LudoHub sur un environnement de test, ou créer une branche Neon à
   partir de la base existante, puis vérifier explicitement `DATABASE_URL`.
2. Appliquer les migrations SQL versionnées avec `pnpm db:migrate`. Son préflight exige que les
   tables historiques `ludotheques` et `attendance_records` existent déjà et refuse une base vide.
3. Examiner le rapport sans écriture : `pnpm db:migrate-sites`.
4. Résoudre les anomalies signalées, puis appliquer : `pnpm db:migrate-sites -- --commit`.
5. Relancer le dry-run : aucun lieu ni `site_id` supplémentaire ne doit être proposé.

Les migrations de ce lot ne constituent pas une baseline historique complète et ne permettent pas
d'initialiser une base vide. Le fichier snapshot sert de référence aux futures générations ; le SQL
de baseline associé reste volontairement vide pour ne pas recréer les tables déjà en place.

Le pilote Neon HTTP n'exécute pas les migrations SQL dans une transaction. Si une instruction
échoue, arrêter le déploiement, conserver le journal d'erreur et comparer les objets créés avec
`0000_sites_foundation.sql` avant toute relance. Sur l'environnement de test, repartir de la branche
Neon restaurée reste le retour arrière de référence ; en production, utiliser le point de
restauration préparé avant le lot.

Le script ne fusionne et ne supprime aucun tenant. Il crée deux lieux pour `paquis-secheron`, un
lieu par défaut pour les autres espaces, puis rattache les fréquentations par slug historique. Les
lignes ambiguës restent volontairement avec `site_id = null` et sont détaillées dans les anomalies.
Les anomalies de fréquentation sont tolérées ; une incohérence structurelle (notamment un nombre de
lieux principaux actifs différent de un) bloque `--commit` avant toute écriture.

## Compatibilité et retour arrière

Pendant la transition, l'application écrit et lit le slug historique `site` avec le nouvel UUID
`site_id`. Un retour applicatif est donc possible sans perte : redéployer la version précédente et
laisser les nouvelles tables en place. Ne pas supprimer les tables ni la colonne dans l'urgence.

Le rollback complet, uniquement après sauvegarde et vérification qu'aucun consommateur ne dépend
des UUID, consiste à retirer la FK `attendance_records_site_tenant_fk`, puis `site_id`,
`site_opening_intervals` et `ludo_sites` via une migration SQL séparée et revue. Le champ `site`
conservé contient toujours les valeurs nécessaires à l'ancienne application.

`db:push` n'est pas utilisé dans ce processus et le script de données n'est jamais lancé
automatiquement en production.
# Purge des adhésions familiales

Le job `GET /api/internal/cron/family-membership-purge` supprime chaque jour les demandes déjà traitées arrivées à leur échéance de conservation. Il exige `Authorization: Bearer $CRON_SECRET`, traite au maximum 1 000 familles par invocation et peut être relancé sans double comptage. `vercel.json` le planifie à 02:17 UTC. Avant toute activation d’un déploiement, définir un `CRON_SECRET` long et aléatoire dans l’environnement concerné ; aucune planification de production n’est activée par la migration locale seule.

## Lot 8 — Procédure de migration

Les migrations `0012_high_snowbird.sql` et `0013_luxuriant_dracula.sql` sont exclusivement additives : elles créent les tables, types, contraintes et index de l’adhésion familiale, sans `DROP` ni modification de données existantes. Elles n’ont été appliquées à aucune base dans ce lot local.

1. Créer une branche Neon isolée et vérifier que ses variables Preview ne pointent pas vers la production.
2. Avant application, contrôler la présence de `ludotheques`, `members`, `ludo_sites` et de leurs clés composites attendues, puis prendre un point de restauration de la branche.
3. Appliquer les migrations sur cette branche de test, lancer les contrôles de contraintes tenant, publication/version, soumission, traitement, paiement et purge, puis exécuter la suite applicative complète.
4. Vérifier après migration que les nouvelles tables `family_*`, les enums et contraintes attendus ainsi que les index de gestion/purge existent, qu’aucune ligne métier antérieure n’a changé et qu’aucune table familiale ne contient encore de données.
5. En cas de migration partielle, restaurer la branche au point précédent plutôt que de supprimer manuellement des objets. En cas de rollback applicatif après migration réussie, redéployer la version applicative précédente et laisser les nouvelles tables inutilisées : leur présence est compatible et évite toute suppression irréversible.
6. La production reste hors périmètre tant que la branche test, la sauvegarde, `CRON_SECRET`, les origines CORS et le déploiement Preview n’ont pas été validés explicitement.
