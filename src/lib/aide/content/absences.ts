import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'absences',
  title: 'Absences',
  intro:
    'Chaque membre signale ses absences (**vacances**, **formation**, **indisponibilité**). Le responsable les valide, et le planning en tient compte.',
  steps: [
    {
      shot: 'traiter',
      title: 'Les demandes à traiter',
      body: [
        'Ouvrez **« Absences »** dans le menu.',
        'Les demandes en attente apparaissent en haut, dans l’encadré **« À traiter »**.',
        'Cliquez sur **« Examiner »** pour **valider** ou **refuser** une demande.',
      ],
      note: 'Cet encadré n’apparaît que pour les **responsables**, et seulement s’il y a des demandes en attente.',
    },
    {
      shot: 'liste',
      title: 'Suivre toutes les absences',
      body: [
        'Le tableau récapitule **chaque demande** avec sa période et son statut.',
        'Le statut indique si la demande est **en attente**, **approuvée** ou **refusée**.',
        'Basculez entre la vue **« Tableau »** et la vue **« Calendrier »** avec le sélecteur en haut.',
      ],
      tips: ['Un responsable peut **filtrer par membre** pour ne voir que ses absences.'],
    },
    {
      title: 'Faire une demande',
      body: [
        'Cliquez sur **« Nouvelle demande »** (ou **« Planifier une absence »** pour un responsable).',
        'Choisissez le **type**, les **dates** de début et de fin, et ajoutez une note si besoin.',
        'Validez : la demande part **en attente** jusqu’à la réponse du responsable.',
      ],
    },
  ],
}
