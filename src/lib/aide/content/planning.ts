import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'planning',
  title: 'Planning',
  intro:
    'Le planning organise les **samedis d’ouverture** sur une saison : qui est de service, quels samedis sont fermés, et quand vous êtes attendu.',
  steps: [
    {
      shot: 'apercu',
      title: 'Voir le planning',
      body: [
        'Cliquez sur **« Planning »** dans le menu.',
        'Le tableau liste **tous les samedis** de la saison en cours.',
        'En haut, un **bandeau coloré** rappelle votre prochain samedi de service.',
      ],
      tips: [
        'Les samedis en période de fermeture affichent **« Fermé »** et n’ont pas d’équipe.',
        'Le compteur **« 2/2 »** indique le nombre de personnes inscrites sur le nombre attendu.',
      ],
    },
    {
      shot: 'prochain',
      title: 'Votre prochain samedi',
      body: [
        'Le bandeau indique la **date** de votre prochain samedi et **dans combien de jours** il tombe.',
        'Les noms en dessous sont les personnes **de service ce jour-là** ; le vôtre est en gras.',
      ],
      note: 'Si vous ne pouvez pas assurer un samedi, posez une **absence** : le planning en tiendra compte.',
    },
    {
      shot: 'saisons',
      title: 'Gérer les saisons',
      body: [
        'Les responsables ouvrent **« Gérer les saisons »** depuis le planning.',
        'Créer une saison **génère automatiquement** tous ses samedis.',
        'La saison marquée **« Active »** est celle affichée à toute l’équipe.',
      ],
      tips: [
        'Une **seule saison active** à la fois ; les autres restent **en préparation** ou **archivées**.',
      ],
    },
  ],
}
