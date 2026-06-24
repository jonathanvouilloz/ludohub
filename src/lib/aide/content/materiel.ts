import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'materiel',
  title: 'Matériel',
  intro:
    'Les **demandes de matériel et de fournitures** de la ludothèque : signalez un besoin, suivez son traitement jusqu’à la réception.',
  steps: [
    {
      shot: 'liste',
      title: 'Demander du matériel',
      body: [
        'Ouvrez **« Matériel »** dans le menu.',
        'Cliquez sur **« Nouvelle demande »**, indiquez ce qu’il faut et son **urgence**.',
        'La demande apparaît dans la liste tant qu’elle n’est pas reçue.',
      ],
      tips: [
        'Une fois le matériel reçu, il est rangé dans la section repliée **« Reçus »**.',
        'Vous pouvez ajouter un **lien** vers le produit pour faciliter l’achat.',
      ],
    },
    {
      shot: 'urgence',
      title: 'Filtrer par urgence',
      body: [
        'Les onglets en haut regroupent les demandes par **niveau d’urgence**.',
        'Trois niveaux : **Critique** (rouge), **Haute** (orange) et **Normale**.',
        'Le **chiffre** sur chaque onglet indique le nombre de demandes concernées.',
      ],
      note: 'Les demandes les plus urgentes remontent **automatiquement en haut** de la liste.',
    },
  ],
}
