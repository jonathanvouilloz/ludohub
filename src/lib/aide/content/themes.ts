import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'themes',
  title: 'Thèmes',
  intro:
    'Le module Thèmes regroupe vos animations : le **catalogue** de vos décors, leurs **objets**, et le suivi des **installations** en cours.',
  steps: [
    {
      shot: 'catalogue',
      title: 'Voir vos thèmes',
      body: [
        'Cliquez sur **« Thèmes »** dans le menu de gauche.',
        'Les thèmes **en cours d’animation** apparaissent tout en haut, dans un encadré coloré.',
        'Les autres thèmes du catalogue sont listés en dessous, sous forme de **cartes**.',
      ],
      note: 'Sur un thème installé, l’encadré rappelle le **dernier check-up** et signale les **objets manquants**.',
    },
    {
      shot: 'fiche',
      title: 'Ouvrir un thème',
      body: [
        'Cliquez sur un thème pour ouvrir sa **fiche**.',
        'À gauche : son **nom**, sa **description** et la liste de tous ses **objets** avec les quantités.',
        'À droite : ses **photos**.',
      ],
    },
    {
      shot: 'fiche-action',
      title: 'Reprendre l’installation depuis la fiche',
      body: [
        'Si le thème est actuellement installé, un **bandeau bleu** apparaît en haut de la fiche.',
        'Cliquez sur **« Voir / check-up »** pour suivre l’installation.',
      ],
    },
    {
      shot: 'installation',
      title: 'Suivre une installation',
      body: [
        'La page d’installation montre les **objets sortis** pour l’animation, à gauche.',
        'À droite : l’**historique des contrôles** déjà effectués.',
        'Pour pointer les objets présents ou manquants, cliquez sur **« Faire un check-up »**.',
      ],
      note: 'Quand un objet est marqué **manquant**, les responsables reçoivent une **notification**.',
    },
    {
      shot: 'installation-kit',
      title: 'Traiter un objet manquant',
      body: [
        'Les objets à traiter apparaissent dans **« État du kit »**.',
        'Pour chacun, indiquez **« Retrouvé »** s’il est revenu, ou **« Perdu définitivement »** sinon.',
      ],
      tips: ['Un objet **retrouvé** repasse automatiquement en présent dans le suivi.'],
    },
  ],
}
