import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'demarrer',
  title: 'Démarrer',
  intro:
    'Chaque ludothèque a un **mot de passe commun**. Vous le saisissez une fois, puis vous choisissez votre nom pour ouvrir votre espace.',
  steps: [
    {
      shot: 'connexion',
      title: 'Se connecter',
      body: [
        'Ouvrez l’**adresse de votre ludothèque** dans le navigateur.',
        'Saisissez le **mot de passe commun** de la ludothèque.',
        'Cliquez sur **« Se connecter »**.',
      ],
      note: 'Le mot de passe est le **même pour toute l’équipe**. Demandez-le à votre responsable si vous ne l’avez pas.',
    },
    {
      shot: 'membres',
      title: 'Choisir qui vous êtes',
      body: [
        'La liste des **membres** de la ludothèque s’affiche.',
        'Cliquez sur **votre nom** : votre espace s’ouvre directement.',
      ],
      tips: [
        'Les **responsables** sont signalés par un badge — ils ont accès à des réglages en plus.',
        'Vous vous êtes trompé de nom ? Déconnectez-vous via **« Quitter »** en bas du menu.',
      ],
    },
    {
      shot: 'accueil',
      title: 'La page d’accueil',
      body: [
        'En haut, le **grand bouton bleu** lance l’action la plus fréquente : ajouter une fréquentation.',
        'La section **« À faire »** rassemble ce qui vous attend (absences à valider, objets à traiter…).',
        'Plus bas, l’**aperçu** donne l’état de chaque module ; cliquez sur une tuile pour l’ouvrir.',
      ],
      tips: [
        'Une **pastille colorée** sur une tuile signale qu’il y a quelque chose à traiter.',
        'Le menu de gauche est toujours visible pour **naviguer entre les modules**.',
      ],
    },
  ],
}
