import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'jeux',
  title: 'Jeux à acheter',
  intro:
    'La liste partagée des **jeux que la ludothèque aimerait acquérir**. Chacun peut proposer un jeu ; on coche ceux qui ont été achetés.',
  steps: [
    {
      shot: 'liste',
      title: 'Voir et proposer un jeu',
      body: [
        'Cliquez sur **« Jeux à acheter »** dans le menu.',
        'La liste montre tous les **jeux souhaités** par l’équipe.',
        'Pour en proposer un, cliquez sur **« Nouveau souhait »** et renseignez son nom.',
      ],
      tips: [
        'Le **prix** et un **lien** vers la boutique sont facultatifs, mais bien pratiques.',
        'Tout le monde peut ajouter un souhait, pas seulement les responsables.',
      ],
    },
    {
      shot: 'carte',
      title: 'Marquer un jeu acheté',
      body: [
        'Chaque carte indique le **prix indicatif** et **qui a ajouté** le jeu.',
        'L’icône **✓** marque le jeu comme **acheté** : il rejoint la section **« Achetés »**.',
        'L’icône **corbeille** retire le souhait de la liste.',
      ],
      note: 'Marquer un jeu acheté est **réversible** : utilisez la flèche de retour pour le remettre dans les souhaits.',
    },
  ],
}
