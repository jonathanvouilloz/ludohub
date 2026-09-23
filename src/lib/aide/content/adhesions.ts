import type { GuideSection } from '$lib/aide/types'

export const section: GuideSection = {
  id: 'adhesions',
  title: 'Adhésions',
  intro:
    'Les **adhésions familiales** se préparent dans LudoHub, puis se traitent sur le poste d’accueil avec l’extension **LudoOrphée**. Le formulaire public, le règlement et les demandes vivent au même endroit.',
  steps: [
    {
      shot: 'telecharger',
      title: 'Télécharger l’extension',
      body: [
        'Ouvrez **« Adhésions »** dans le menu.',
        'Dans le panneau **« Extension Orphée »**, cliquez sur **« Télécharger l’extension »**.',
        'Décompressez l’archive. Vous obtenez un dossier **ludo-orphee**.',
      ],
      note: 'Gardez ce dossier : une mise à jour consiste à le remplacer, puis à cliquer sur **Recharger** dans Chrome.',
    },
    {
      shot: 'chrome-extensions',
      title: 'Ouvrir la page des extensions',
      body: [
        'Dans Chrome, saisissez **chrome://extensions** dans la barre d’adresse, puis validez.',
        'La page liste les extensions déjà installées sur ce poste.',
      ],
    },
    {
      shot: 'chrome-developer',
      title: 'Activer le mode développeur',
      body: [
        'En haut à droite de **chrome://extensions**, activez **Mode développeur**.',
        'De nouveaux boutons apparaissent, dont **« Charger l’extension non empaquetée »**.',
      ],
      note: 'Ce mode reste sur le poste d’accueil. Il ne change rien pour les familles.',
    },
    {
      shot: 'chrome-load',
      title: 'Charger le dossier',
      body: [
        'Cliquez sur **« Charger l’extension non empaquetée »**.',
        'Choisissez le dossier **ludo-orphee**, pas le fichier zip.',
        'Épinglez **LudoOrphée** pour le retrouver à côté de la barre d’adresse.',
      ],
    },
    {
      shot: 'liaison',
      title: 'Relier le poste à LudoHub',
      body: [
        'Ouvrez le panneau de l’extension, puis cliquez sur **« Connecter cet appareil »**.',
        'Une page LudoHub s’ouvre avec un **code de liaison**. Connectez-vous comme responsable si ce n’est pas déjà fait.',
        'Vérifiez que le code est le même que dans l’extension, puis cliquez sur **« Autoriser ce poste »**.',
        'De retour dans l’extension, choisissez **votre ludothèque**.',
      ],
      note: 'Aucun mot de passe n’est saisi dans l’extension. La liaison se fait une fois par poste.',
    },
    {
      shot: 'formulaire',
      title: 'Régler le formulaire',
      body: [
        'Dans **« Formulaire public »**, rédigez le **titre**, le **texte d’introduction** et le **texte de la case à cocher**.',
        'Indiquez le **tarif annuel**, la **durée de conservation** des demandes, et les moyens de paiement acceptés (**TWINT**, **espèces**).',
        'Cochez **« Accepter les demandes »**, puis **« Enregistrer les réglages »**.',
      ],
    },
    {
      shot: 'reglement',
      title: 'Règlement et publication',
      body: [
        'Dans **« Règlement de la ludothèque »**, écrivez ou collez votre règlement, puis enregistrez.',
        'Les familles le liront dans une fenêtre avant de cocher leur consentement.',
        'Contrôlez le lien avec **« Voir le formulaire »**, puis cliquez sur **« Publier les modifications »**.',
      ],
      tips: [
        '**« Copier le lien »** sert à le transmettre ou à le placer sur votre site.',
        'Sans règlement publié et sans texte de consentement, le formulaire public ne s’ouvre pas.',
      ],
    },
    {
      shot: 'detail',
      title: 'Lire une demande',
      body: [
        'La section **« Demandes reçues »** liste chaque famille, avec la date, le statut et le paiement.',
        'Cliquez sur le **nom du responsable** : une fenêtre affiche le contact, l’adresse, le consentement et les membres.',
      ],
      note: 'La fenêtre s’ouvre sur place. La page ne se recharge pas.',
    },
    {
      shot: 'demandes',
      title: 'Traiter ou supprimer',
      body: [
        '**« Marquer comme traitée »** indique que la famille a été saisie dans Orphée.',
        'Ensuite, enregistrez le paiement **TWINT** ou **espèces**, ou laissez **Non payé**.',
        '**Supprimer** retire la demande après confirmation. Les informations de la famille sont effacées.',
      ],
      tips: [
        'L’extension peut aussi remplir Orphée et imprimer la quittance, une fois le poste relié.',
        'Une demande traitée est de toute façon effacée au bout du délai de conservation.',
      ],
    },
  ],
}
