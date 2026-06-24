import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'newsletter',
  title: 'Newsletter',
  intro:
    'La **newsletter** sert à écrire au **public** de votre ludothèque (familles, crèches, partenaires) — un carnet de contacts distinct de vos membres. Gérez votre liste, rédigez une campagne dans votre charte, et envoyez-la en un clic.',
  steps: [
    {
      shot: 'contacts',
      title: 'Gérer vos contacts',
      body: [
        'Ouvrez **« Contacts »** : c’est votre public, séparé de vos membres et bénévoles.',
        'Cliquez sur **« Ajouter un contact »** pour en saisir un à la main, ou **« Importer »** pour charger un fichier Excel/CSV.',
        'Chaque contact peut recevoir un **segment** (famille, institution, partenaire…) ; le résumé s’affiche juste sous le titre.',
      ],
      tips: [
        'À l’import, un écran de **correspondance des colonnes** + un aperçu écartent les doublons et les emails invalides.',
        'Les icônes de chaque ligne permettent de **désabonner**, **anonymiser** (RGPD) ou **supprimer** un contact.',
      ],
    },
    {
      shot: 'campagnes',
      title: 'Créer une campagne',
      body: [
        'La page **« Campagnes »** liste tout ce que vous avez écrit, avec son statut : **Brouillon** ou **Envoyée**.',
        'Cliquez sur **« Nouvelle campagne »** pour démarrer un brouillon.',
        'Sur une campagne déjà envoyée, l’icône **graphique** ouvre son **rapport d’envoi**.',
      ],
    },
    {
      shot: 'editeur',
      title: 'Rédiger et prévisualiser',
      body: [
        'À **gauche**, remplissez l’**objet**, le **message**, et au besoin une **image**, un **bouton** ou un **PDF**.',
        'À **droite**, l’**aperçu** se met à jour en temps réel : vous voyez exactement l’email que recevra le public.',
        'En bas : choisissez les **destinataires**, envoyez-vous un **test**, puis **« Envoyer la campagne »**.',
      ],
      tips: [
        'Écrivez `{{first_name}}` dans le message : il sera remplacé par le **prénom** de chaque destinataire.',
        'Ciblez **un segment** (ex. seulement les familles) ou **tous les abonnés** d’un coup.',
      ],
      note: 'Le lien de **désabonnement** est ajouté automatiquement en bas de chaque email — rien à faire de votre côté, c’est une obligation légale gérée pour vous.',
    },
    {
      shot: 'rapport',
      title: 'Suivre l’envoi',
      body: [
        'Une fois envoyée, le **rapport** indique combien d’emails sont **partis**, les **échecs**, et les **rejets/plaintes**.',
        'Les rejets (adresses qui n’existent plus) sont mis à jour **automatiquement** ; ces contacts sont exclus des prochains envois.',
      ],
    },
  ],
}
