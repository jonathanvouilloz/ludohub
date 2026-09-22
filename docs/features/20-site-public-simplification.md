# 20 — Simplification du dashboard du site public

> Statut : **PLAN VALIDÉ — prêt à implémenter**  
> Date de validation : 23 septembre 2026  
> Périmètre initial : dashboard LudoHub, avec les adaptations minimales de l'API nécessaires pour
> conserver un site public fonctionnel.

## Contexte et principe directeur

La gestion du site public est encore trop technique pour les équipes des ludothèques. L'objectif de
ce lot est de remplacer les réglages éditoriaux détaillés par des formulaires courts, explicites et
adaptés à un usage occasionnel.

Le projet est encore en développement et ne contient aucune donnée importante à préserver. Les
changements de schéma peuvent donc être directs : **aucun backfill, aucune migration de contenu
historique et aucune période de rétrocompatibilité des données ne sont requis**. La base de
développement peut être réinitialisée si cela simplifie l'implémentation.

Principes communs :

- une création ou modification doit se faire dans un seul formulaire ;
- ne pas exposer de champs techniques (`slug`, ordre numérique, règle de récurrence, relation
  interne) ;
- publier ou masquer avec une case compréhensible plutôt qu'un cycle éditorial complexe ;
- conserver uniquement les données réellement affichées ou utilisées ;
- garder les actions de suppression visibles, confirmées et fiables ;
- mettre à jour les tests du dashboard et le contrat public affecté dans le même lot.

## 1. Actualités

### Résultat attendu

Une actualité possède un titre, un résumé, un texte, une image facultative et des PDF facultatifs.
Il n'existe plus de distinction entre « image de couverture » et « image dans l'actualité ».

### Travaux

- [ ] Retirer l'image de couverture du formulaire de création et de modification.
- [ ] Retirer la section de gestion de couverture de la fiche d'une actualité.
- [ ] Conserver une seule image éditoriale, gérée dans le même formulaire que le contenu.
- [ ] Utiliser cette image dans les cartes/listes et dans la page complète de l'actualité.
- [ ] Conserver l'ajout et le retrait de PDF.
- [ ] Simplifier le modèle et supprimer les colonnes/actions devenues inutiles.
- [ ] Adapter la projection de l'API publique sans maintenir l'ancien double modèle d'image.
- [ ] Mettre à jour les tests des formulaires, médias, listes et détails publics.

## 2. Suppression des actualités

### Résultat attendu

Une actualité peut être supprimée définitivement depuis sa fiche, avec une confirmation claire. La
suppression retire aussi son image et ses PDF, puis revient à la liste.

### Travaux

- [ ] Reproduire le défaut actuel depuis la vraie route de détail.
- [ ] Définir l'action de suppression directement sur la route qui porte la fiche, sans dépendance
  fragile à une action réexportée.
- [ ] Supprimer l'actualité et ses relations en base.
- [ ] Nettoyer les fichiers associés sans laisser un échec secondaire empêcher la navigation.
- [ ] Afficher une erreur exploitable si la suppression principale échoue.
- [ ] Ajouter un test de route couvrant confirmation, suppression, nettoyage et redirection.
- [ ] Tester la suppression d'une actualité visible et d'une actualité masquée.

## 3. Activités et rythme

### Résultat attendu

Le rythme d'une activité est un simple badge. Les dates, horaires, périodes et éventuelles
exceptions sont écrits directement dans la description par l'équipe.

### Badges retenus

- **Ponctuelle** : organisée une fois ou pendant une période précise ;
- **Récurrente** : revient régulièrement ;
- **Permanente** : proposée en continu ou toute l'année.

Le badge **Sur inscription** reste calculé automatiquement lorsque les inscriptions sont activées ;
il ne constitue pas un quatrième rythme.

### Travaux

- [ ] Retirer dates, heures, fréquence, nombre de séances, date de fin et exceptions du formulaire.
- [ ] Remplacer le bloc « Rythme » par un choix unique entre les trois badges.
- [ ] Supprimer les règles métier exigeant une date ou une règle de récurrence.
- [ ] Simplifier le schéma en retirant les occurrences et exceptions structurées devenues inutiles.
- [ ] Conserver le lieu/précision pratique et la description libre.
- [ ] Afficher le badge dans la liste et la fiche du dashboard.
- [ ] Exposer le rythme simple dans l'API publique.
- [ ] Dans le lot site public, afficher le badge sur les cartes et les pages d'activité, sans
  interprétation automatique des dates saisies dans la description.
- [ ] Réécrire les tests du service, des routes et du contrat public autour de ce modèle simplifié.

## 4. Information propre à un lieu

### Résultat attendu

Chaque lieu peut porter un message d'information facultatif, distinct des informations d'accès et
des horaires. Le message reste affiché jusqu'à ce qu'il soit modifié ou retiré ; il n'a pas de dates
de début ou de fin.

### Travaux

- [ ] Ajouter un champ texte multiligne facultatif, limité à environ 500 caractères.
- [ ] Le nommer clairement « Information importante sur ce lieu » dans l'éditeur de lieu.
- [ ] Conserver séparément « Informations d'accès et transports ».
- [ ] Ajouter le champ au service, au schéma et à l'API publique des lieux.
- [ ] Prévoir un aperçu lisible dans la page « Lieux et horaires ».
- [ ] Dans le lot site public, afficher ce message sous forme d'encadré partout où les informations
  détaillées de ce lieu sont présentées.
- [ ] Tester l'absence, l'ajout, la modification et le retrait du message.

## 5. FAQ

### Résultat attendu

Une entrée de FAQ contient une question, une réponse en texte simple et une catégorie choisie dans
une liste. Aucun Markdown et aucun ordre numérique ne sont exposés.

### Catégories par défaut

1. Adhésion et tarifs
2. Emprunts et retours
3. Horaires et accès
4. Jeux sur place
5. Enfants et accompagnement
6. Activités et événements
7. Autre

### Travaux

- [ ] Remplacer « Réponse Markdown » par une zone de texte simple.
- [ ] Renommer les champs techniques pour refléter du texte brut.
- [ ] Afficher les retours à la ligne sans interpréter de syntaxe Markdown.
- [ ] Remplacer la catégorie libre par une liste déroulante.
- [ ] Ajouter une gestion légère des catégories dans la page FAQ : ajout, renommage, désactivation
  et ordre des catégories.
- [ ] Initialiser automatiquement les catégories par défaut pour chaque ludothèque.
- [ ] Retirer le champ « Ordre » du formulaire FAQ.
- [ ] Ordonner les catégories selon leur réglage et les questions selon leur création à l'intérieur
  de chaque catégorie.
- [ ] Conserver la publication, le masquage et la suppression dans une interface compacte.
- [ ] Adapter l'API et le rendu du site public au texte brut.
- [ ] Mettre à jour les tests CRUD, catégories et contrat public.

## 6. Équipe et comité

### Résultat attendu

La création et l'édition d'un profil se font dans un formulaire unique avec seulement :

- groupe : Équipe ou Comité ;
- nom affiché ;
- fonction ;
- petite bio en texte simple, 255 caractères maximum ;
- photo facultative ;
- visibilité sur le site.

### Travaux

- [ ] Retirer « Membre lié » du formulaire et du modèle public.
- [ ] Retirer « Lieux concernés » : chaque profil concerne automatiquement tous les lieux actifs.
- [ ] Retirer le champ « Ordre » du formulaire.
- [ ] Utiliser un ordre automatique par groupe puis par date de création.
- [ ] Remplacer la bio Markdown par une zone de texte simple limitée à 255 caractères.
- [ ] Intégrer ajout, remplacement et retrait de la photo dans le formulaire du profil.
- [ ] Déduire par défaut le texte alternatif de la photo depuis le nom affiché.
- [ ] Intégrer la visibilité au même formulaire.
- [ ] Simplifier la liste : identité, groupe, fonction, statut, Modifier et Supprimer.
- [ ] Adapter le schéma, le service, l'API publique et le rendu du site.
- [ ] Mettre à jour les tests CRUD, photo, publication et suppression.

## 7. Ordre d'exécution

1. Simplifier le schéma et les contrats métier.
2. Corriger définitivement la suppression des actualités.
3. Refaire le formulaire des actualités et leur média unique.
4. Simplifier les activités et leurs badges.
5. Ajouter le message propre aux lieux.
6. Simplifier la FAQ et ajouter ses catégories.
7. Refaire Équipe et Comité en formulaire unique.
8. Adapter les projections de l'API publique.
9. Mettre à jour le site public pour les nouveaux champs et badges.
10. Exécuter les tests ciblés, puis `pnpm check` et la suite Vitest complète.

## Critères de fin

- [ ] Aucun formulaire concerné n'expose de slug, ordre numérique ou relation interne.
- [ ] Une actualité ne propose qu'une image et des PDF.
- [ ] La suppression d'une actualité fonctionne depuis sa fiche et revient à la liste.
- [ ] Une activité n'exige aucune date structurée et affiche son badge de rythme.
- [ ] Chaque lieu accepte un message d'information facultatif exposé par l'API.
- [ ] Une FAQ est une question/réponse en texte simple avec catégorie sélectionnable.
- [ ] Les catégories FAQ par défaut existent et sont administrables.
- [ ] Un profil Équipe/Comité se crée et se modifie en une seule soumission.
- [ ] La bio d'un profil est limitée à 255 caractères.
- [ ] Les routes publiques affectées restent typées et testées.
- [ ] `pnpm check` et les tests ciblés passent sans erreur.

