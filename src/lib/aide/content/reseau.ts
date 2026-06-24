import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'reseau',
  title: 'Réseau',
  intro:
    'Le **réseau** relie toutes les ludothèques : demandez un renfort, empruntez un thème à une autre ludo, et suivez ce qui vous concerne dans vos notifications.',
  steps: [
    {
      shot: 'aide',
      title: 'Demander ou offrir de l’aide',
      body: [
        'Ouvrez **« Aide »** dans le menu Réseau : vous voyez les demandes de **toutes les ludothèques**.',
        'Pour aider, cliquez sur **« Je suis disponible »** sur la carte qui vous intéresse.',
        'Pour demander un renfort, cliquez sur **« Nouvelle demande »** et indiquez la date.',
      ],
      tips: [
        'Sur **vos propres** demandes, la liste des **volontaires** s’affiche directement sur la carte.',
        'Vos demandes terminées sont rangées plus bas dans **« Mes demandes passées »**.',
      ],
    },
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
        'Les **filtres** en haut trient par domaine (thèmes, aide, matériel…).',
        'Une notification **non lue** est surlignée ; cliquez dessus pour ouvrir l’élément concerné.',
      ],
      tips: [
        'Le badge **« À traiter »** signale une action attendue de votre part.',
        'Le bouton **« Tout marquer comme lu »** vide le surlignage d’un coup.',
      ],
    },
  ],
}
