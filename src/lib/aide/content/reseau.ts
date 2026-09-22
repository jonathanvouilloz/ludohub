import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'reseau',
  title: 'Réseau',
  intro:
    'Le **réseau** relie les ludothèques : empruntez un thème à une autre ludo et suivez ce qui vous concerne dans vos notifications.',
  steps: [
    {
      shot: 'catalogue',
      title: 'Emprunter un thème partagé',
      body: [
        'Ouvrez **« Catalogue »** : ce sont les thèmes que les **autres ludothèques** partagent.',
        'Une pastille indique l’état : **Disponible**, **En prêt** ou **Emprunté par vous**.',
        'Cliquez sur **« Demander ce thème »** pour envoyer une demande d’emprunt à la ludo propriétaire.',
      ],
      note: 'La ludo propriétaire reçoit votre demande et la **confirme** ; le thème passe alors « Emprunté par vous ».',
    },
    {
      shot: 'notifications',
      title: 'Suivre vos notifications',
      body: [
        'La cloche du menu mène à vos **notifications** : tout ce qui concerne votre ludothèque.',
        'Les **filtres** en haut trient par domaine (thèmes, absences, matériel…).',
        'Une notification **non lue** est surlignée ; cliquez dessus pour ouvrir l’élément concerné.',
      ],
      tips: [
        'Le badge **« À traiter »** signale une action attendue de votre part.',
        'Le bouton **« Tout marquer comme lu »** vide le surlignage d’un coup.',
      ],
    },
  ],
}
