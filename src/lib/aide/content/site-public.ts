import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'site-public',
  title: 'Site public',
  intro:
    'Les informations destinées aux visiteurs se gèrent depuis **« Site public »**. Les responsables peuvent notamment mettre à jour les lieux de **Pâquis** et **Sécheron** et leurs heures d’ouverture.',
  steps: [
    {
      title: 'Modifier les lieux et horaires',
      body: [
        'Ouvrez **« Site public »**, puis choisissez **« Lieux et horaires »** dans la section **« Informations du site »**.',
        'Cliquez sur **« Modifier »**, puis ouvrez la fiche de **Pâquis** ou de **Sécheron**.',
        'Changez les coordonnées ou les heures voulues, puis cliquez sur **« Enregistrer »** dans la fiche du lieu.',
      ],
      tips: [
        'Utilisez **« Ajouter une plage »** pour ouvrir deux fois le même jour, par exemple le matin puis l’après-midi.',
        'La corbeille retire une plage ; un jour sans plage est affiché comme **fermé**.',
      ],
      note: 'Après l’enregistrement, le site public lit automatiquement les nouvelles informations. Il n’y a pas de seconde publication à effectuer.',
    },
    {
      title: 'Vérifier avant de quitter',
      body: [
        'Une fois la fiche enregistrée, cliquez sur **« Voir l’aperçu »**.',
        'Contrôlez le lieu, l’adresse et chaque plage horaire tels qu’ils seront présentés aux visiteurs.',
      ],
      note: 'Seuls les responsables peuvent modifier ces informations. Les autres membres peuvent les consulter lorsque le site public est actif.',
    },
  ],
}
