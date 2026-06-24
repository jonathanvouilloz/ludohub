/**
 * Seed démo — tenant figé `demo` pour la génération de documentation (skill user-docs).
 *
 * Crée une ludothèque de démonstration avec des données fictives (aucune PII réelle)
 * et des UUID FIXES, pour que les routes restent stables entre deux reseed et que
 * les captures Playwright soient déterministes.
 *
 * Idempotent et destructif sur le seul tenant `demo` : supprime la ludo `demo`
 * (cascade → membres, thèmes, items, installations, check-ups) puis recrée tout.
 * Ne touche à aucune autre ludothèque.
 *
 * Mot de passe : `demo2026`.
 *
 * Autonome (tsx, hors runtime SvelteKit). Lancer : pnpm tsx scripts/seed-demo.ts
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { inArray, or } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { hashPassword } from 'better-auth/crypto'
import {
  ludotheques,
  members,
  themes,
  themeItems,
  themeInstallations,
  themeInstallationItems,
  themeCheckups,
  themeCheckupItems,
  themeLoans,
  seasons,
  saturdaySlots,
  assignments,
  closurePeriods,
  seasonMemberSettings,
  absences,
  helpRequests,
  helpResponses,
  gameWishes,
  supplyRequests,
  notifications,
  newsletterContacts,
  campaigns,
  campaignSends,
} from '../src/lib/server/schema.js'

// ─── UUID fixes (routes stables) ─────────────────────────────────────────────
const LUDO = '0d000000-0000-4000-8000-000000000001'
const M_RESP = '0d000000-0000-4000-8000-000000000010'
const M_BENE = '0d000000-0000-4000-8000-000000000011'
const T_PIRATES = '0d000000-0000-4000-8000-000000000100'
const T_ESPACE = '0d000000-0000-4000-8000-000000000200'
const INSTALL = '0d000000-0000-4000-8000-000000000300'
// Items Pirates (les 4 premiers entrent dans l'installation)
const PI = [
  '0d000000-0000-4000-8000-000000000101',
  '0d000000-0000-4000-8000-000000000102',
  '0d000000-0000-4000-8000-000000000103',
  '0d000000-0000-4000-8000-000000000104',
  '0d000000-0000-4000-8000-000000000105',
  '0d000000-0000-4000-8000-000000000106',
]
const II = [
  '0d000000-0000-4000-8000-000000000310',
  '0d000000-0000-4000-8000-000000000311',
  '0d000000-0000-4000-8000-000000000312',
  '0d000000-0000-4000-8000-000000000313',
]
const CHK = '0d000000-0000-4000-8000-000000000320'
// Planning : saison, samedis, fermeture, réglages membre
const SEASON = '0d000000-0000-4000-8000-000000000400'
const CLOSURE = '0d000000-0000-4000-8000-000000000440'
const SMS = [
  '0d000000-0000-4000-8000-000000000450', // Camille (permanent)
  '0d000000-0000-4000-8000-000000000451', // Sacha
]
// Absences (figées) : 1 en attente + 2 traitées
const ABS = [
  '0d000000-0000-4000-8000-000000000520',
  '0d000000-0000-4000-8000-000000000521',
  '0d000000-0000-4000-8000-000000000522',
]

// ─── Batch 2 : Réseau + Jeux + Matériel ──────────────────────────────────────
// Seconde ludo de démo (« voisine ») : rend les écrans RÉSEAU réalistes côté
// `demo` (catalogue partagé = thèmes des AUTRES ludos ; feed d'aide = demandes
// ouvertes de tout le réseau). N'impacte aucune des 12 vraies ludos genevoises.
const VOISINE = '0d000000-0000-4000-8000-000000000600'
const MV_RESP = '0d000000-0000-4000-8000-000000000610'
const TV_CHATEAU = '0d000000-0000-4000-8000-000000000700' // partagé, disponible
const TV_FERME = '0d000000-0000-4000-8000-000000000710' // partagé, prêté à demo
const LOAN = '0d000000-0000-4000-8000-000000000720'
// Demandes d'aide : 1 ouverte (voisine) + 1 ouverte (demo, avec volontaire) + 1 passée (demo)
const HR_VOISINE = '0d000000-0000-4000-8000-000000000800'
const HR_DEMO = '0d000000-0000-4000-8000-000000000810'
const HR_PAST = '0d000000-0000-4000-8000-000000000820'
const HRESP = '0d000000-0000-4000-8000-000000000830'

// ─── Newsletter : contacts (public) + campagnes ──────────────────────────────
// Contacts du public côté `demo` (route /demo/newsletter). UUID fixes pour les
// envois (campaign_sends) ; la campagne envoyée + le brouillon ont des id stables
// (routes éditeur /[id] et rapport /[id]/stats).
const NL_C = [
  '0d000000-0000-4000-8000-000000000900',
  '0d000000-0000-4000-8000-000000000901',
  '0d000000-0000-4000-8000-000000000902',
  '0d000000-0000-4000-8000-000000000903',
  '0d000000-0000-4000-8000-000000000904',
  '0d000000-0000-4000-8000-000000000905',
  '0d000000-0000-4000-8000-000000000906',
  '0d000000-0000-4000-8000-000000000907',
  '0d000000-0000-4000-8000-000000000908',
]
const CAMP_DRAFT = '0d000000-0000-4000-8000-000000000950'
const CAMP_SENT = '0d000000-0000-4000-8000-000000000951'

// Samedis de la saison démo (dates figées pour des captures stables).
// `assigned` = Camille + Sacha sont de service ce samedi-là. Le premier samedi
// futur assigné alimente le bandeau « Mon prochain samedi » du planning.
const SATURDAYS: { id: string; date: string; assigned: boolean }[] = [
  { id: '0d000000-0000-4000-8000-000000000410', date: '2026-06-06', assigned: false },
  { id: '0d000000-0000-4000-8000-000000000411', date: '2026-06-13', assigned: false },
  { id: '0d000000-0000-4000-8000-000000000412', date: '2026-06-20', assigned: true },
  { id: '0d000000-0000-4000-8000-000000000413', date: '2026-06-27', assigned: true },
  { id: '0d000000-0000-4000-8000-000000000414', date: '2026-07-04', assigned: true },
  { id: '0d000000-0000-4000-8000-000000000415', date: '2026-07-11', assigned: false },
  { id: '0d000000-0000-4000-8000-000000000416', date: '2026-07-18', assigned: false }, // fermeture
  { id: '0d000000-0000-4000-8000-000000000417', date: '2026-07-25', assigned: false }, // fermeture
  { id: '0d000000-0000-4000-8000-000000000418', date: '2026-08-22', assigned: false }, // fermeture
  { id: '0d000000-0000-4000-8000-000000000419', date: '2026-08-29', assigned: false },
  { id: '0d000000-0000-4000-8000-00000000041a', date: '2026-09-05', assigned: true },
  { id: '0d000000-0000-4000-8000-00000000041b', date: '2026-09-12', assigned: false },
]

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (.env)')
  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql)

  // 1. Reset des deux tenants de démo (`demo` + `demo-voisine`). Plusieurs FK
  //    n'ont PAS de cascade et bloqueraient la suppression des ludos — on purge
  //    donc explicitement, dans l'ordre, ce qui les référence :
  //    - help_requests (FK ludoId cascade) → cascade help_responses, ce qui retire
  //      aussi les réponses inter-ludos (helpResponses.ludoId/memberId sans cascade) ;
  //    - theme_loans (from/to ludoId sans cascade) ;
  //    - theme_installations (ludoId sans cascade — une install peut être à une emprunteuse).
  //    Le reste part en cascade avec la ludo (slug).
  const DEMO_LUDOS = [LUDO, VOISINE]
  await db.delete(helpRequests).where(inArray(helpRequests.ludoId, DEMO_LUDOS))
  await db
    .delete(themeLoans)
    .where(or(inArray(themeLoans.fromLudoId, DEMO_LUDOS), inArray(themeLoans.toLudoId, DEMO_LUDOS)))
  await db.delete(themeInstallations).where(inArray(themeInstallations.ludoId, DEMO_LUDOS))
  await db.delete(ludotheques).where(inArray(ludotheques.slug, ['demo', 'demo-voisine']))

  // 2. Ludothèque démo
  await db.insert(ludotheques).values({
    id: LUDO,
    name: 'Ludothèque Démo',
    slug: 'demo',
    passwordHash: await hashPassword('demo2026'),
    color: '#0073E6',
    address: 'Rue de la Démo 1, 1200 Genève',
    phone: '+41 22 000 00 00',
    email: 'demo@ludohub.ch',
    responsible: 'Camille Démo',
  })

  // 3. Membres
  await db.insert(members).values([
    { id: M_RESP, ludoId: LUDO, name: 'Camille Démo', role: 'responsable', isActive: true },
    { id: M_BENE, ludoId: LUDO, name: 'Sacha Bénévole', role: 'member', isActive: true },
  ])

  // 4. Thèmes
  await db.insert(themes).values([
    {
      id: T_PIRATES,
      ownerLudoId: LUDO,
      name: 'Pirates des Caraïbes',
      description: 'Un grand décor de bateau pirate avec coffres, déguisements et trésors.',
      isShareable: true,
    },
    {
      id: T_ESPACE,
      ownerLudoId: LUDO,
      name: 'Voyage dans l’espace',
      description: 'Fusée, planètes et combinaisons d’astronaute pour explorer le cosmos.',
      isShareable: true,
    },
  ])

  // 5. Items du thème Pirates (les 4 premiers iront dans l'installation)
  await db.insert(themeItems).values([
    { id: PI[0], themeId: T_PIRATES, name: 'Coffre au trésor', quantity: 1 },
    { id: PI[1], themeId: T_PIRATES, name: 'Chapeau de capitaine', quantity: 4 },
    { id: PI[2], themeId: T_PIRATES, name: 'Épée en mousse', quantity: 6 },
    { id: PI[3], themeId: T_PIRATES, name: 'Drapeau pirate', quantity: 2 },
    { id: PI[4], themeId: T_PIRATES, name: 'Longue-vue', quantity: 3 },
    { id: PI[5], themeId: T_PIRATES, name: 'Perroquet en peluche', quantity: 1 },
  ])

  // Items du thème Espace (UUID aléatoires, hors routes)
  await db.insert(themeItems).values([
    { themeId: T_ESPACE, name: 'Maquette de fusée', quantity: 1 },
    { themeId: T_ESPACE, name: 'Combinaison d’astronaute', quantity: 3 },
    { themeId: T_ESPACE, name: 'Planètes suspendues', quantity: 8 },
    { themeId: T_ESPACE, name: 'Casque spatial', quantity: 3 },
  ])

  // 6. Installation en cours du thème Pirates (mini theme kit : 4 items sortis)
  // Dates figées (déterminisme des captures — sinon defaultNow() les fait dériver).
  const INSTALLED_AT = new Date('2026-06-20T09:00:00Z')
  const CHECKED_AT = new Date('2026-06-20T16:30:00Z')

  await db.insert(themeInstallations).values({
    id: INSTALL,
    themeId: T_PIRATES,
    ludoId: LUDO,
    installedByMemberId: M_RESP,
    status: 'en_cours',
    notes: 'Installé pour l’animation du samedi.',
    installedAt: INSTALLED_AT,
    createdAt: INSTALLED_AT,
  })

  await db.insert(themeInstallationItems).values([
    { id: II[0], installationId: INSTALL, themeItemId: PI[0], condition: 'present' },
    { id: II[1], installationId: INSTALL, themeItemId: PI[1], condition: 'present' },
    { id: II[2], installationId: INSTALL, themeItemId: PI[2], condition: 'present' },
    // Un objet manquant → déclenche l'état "action requise" sur la fiche.
    { id: II[3], installationId: INSTALL, themeItemId: PI[3], condition: 'manquant' },
  ])

  // 7. Un check-up daté qui a relevé l'objet manquant
  await db.insert(themeCheckups).values({
    id: CHK,
    installationId: INSTALL,
    checkedByMemberId: M_RESP,
    notes: 'Contrôle de fin de journée.',
    checkedAt: CHECKED_AT,
    createdAt: CHECKED_AT,
  })
  await db.insert(themeCheckupItems).values([
    { checkupId: CHK, installationItemId: II[0], status: 'present' },
    { checkupId: CHK, installationItemId: II[1], status: 'present' },
    { checkupId: CHK, installationItemId: II[2], status: 'present' },
    { checkupId: CHK, installationItemId: II[3], status: 'manquant', note: 'Drapeau introuvable.' },
  ])

  // ─── Planning ────────────────────────────────────────────────────────────
  // Saison active « Saison 2026 » avec ses samedis. Camille est permanente.
  await db.insert(seasons).values({
    id: SEASON,
    ludoId: LUDO,
    name: '2026',
    startDate: '2026-04-01',
    endDate: '2026-12-20',
    isActive: true,
  })

  await db.insert(saturdaySlots).values(
    SATURDAYS.map((s) => ({
      id: s.id,
      seasonId: SEASON,
      date: s.date,
      type: 'normal' as const,
      requiredCount: 2,
    })),
  )

  // Camille + Sacha de service sur les samedis marqués `assigned`.
  let asgN = 0x430
  const assignmentRows = SATURDAYS.filter((s) => s.assigned).flatMap((s) =>
    [M_RESP, M_BENE].map((memberId) => ({
      id: `0d000000-0000-4000-8000-000000000${(asgN++).toString(16)}`,
      slotId: s.id,
      memberId,
    })),
  )
  await db.insert(assignments).values(assignmentRows)

  // Vacances d'été : les samedis du 13.07 au 24.08 s'affichent « fermé ».
  await db.insert(closurePeriods).values({
    id: CLOSURE,
    seasonId: SEASON,
    label: 'Vacances d’été',
    startDate: '2026-07-13',
    endDate: '2026-08-24',
  })

  await db.insert(seasonMemberSettings).values([
    { id: SMS[0], seasonId: SEASON, memberId: M_RESP, isPermanent: true },
    { id: SMS[1], seasonId: SEASON, memberId: M_BENE, isPermanent: false },
  ])

  // ─── Absences ────────────────────────────────────────────────────────────
  // 1 demande en attente (alimente le bandeau « À traiter ») + 2 traitées.
  await db.insert(absences).values([
    {
      id: ABS[0],
      ludoId: LUDO,
      memberId: M_BENE,
      type: 'vacances',
      startDate: '2026-07-20',
      endDate: '2026-08-02',
      status: 'en_attente',
      notes: 'Vacances en famille, de retour le 3 août.',
    },
    {
      id: ABS[1],
      ludoId: LUDO,
      memberId: M_BENE,
      type: 'formation',
      startDate: '2026-09-12',
      endDate: '2026-09-12',
      status: 'approuve',
      notes: 'Formation premiers secours.',
      responderNotes: 'Validé, pense à nous faire un retour !',
      respondedBy: M_RESP,
    },
    {
      id: ABS[2],
      ludoId: LUDO,
      memberId: M_RESP,
      type: 'indisponible',
      startDate: '2026-08-29',
      endDate: '2026-08-29',
      status: 'approuve',
      respondedBy: M_RESP,
    },
  ])

  // ─── Réseau : ludo voisine + catalogue partagé + prêt ──────────────────────
  await db.insert(ludotheques).values({
    id: VOISINE,
    name: 'Ludothèque Voisine',
    slug: 'demo-voisine',
    passwordHash: await hashPassword('demo2026'),
    color: '#7C3AED',
    address: 'Avenue des Jeux 7, 1205 Genève',
    phone: '+41 22 111 11 11',
    email: 'voisine@ludohub.ch',
    responsible: 'Alex Voisin',
  })

  await db.insert(members).values({
    id: MV_RESP,
    ludoId: VOISINE,
    name: 'Alex Voisin',
    role: 'responsable',
    isActive: true,
  })

  // Deux thèmes partagés par la voisine → visibles dans le catalogue réseau de `demo`.
  await db.insert(themes).values([
    {
      id: TV_CHATEAU,
      ownerLudoId: VOISINE,
      name: 'Château fort',
      description: 'Donjon, chevaliers, catapulte et boucliers pour un tournoi médiéval.',
      isShareable: true,
    },
    {
      id: TV_FERME,
      ownerLudoId: VOISINE,
      name: 'La ferme',
      description: 'Animaux en peluche, tracteur et bottes de foin pour les plus petits.',
      isShareable: true,
    },
  ])

  await db.insert(themeItems).values([
    { themeId: TV_CHATEAU, name: 'Donjon en carton', quantity: 1 },
    { themeId: TV_CHATEAU, name: 'Bouclier de chevalier', quantity: 6 },
    { themeId: TV_CHATEAU, name: 'Catapulte', quantity: 1 },
    { themeId: TV_FERME, name: 'Tracteur à enfourcher', quantity: 1 },
    { themeId: TV_FERME, name: 'Animaux en peluche', quantity: 8 },
  ])

  // Prêt actif de « La ferme » à `demo` → s'affiche « Emprunté par vous » côté demo.
  await db.insert(themeLoans).values({
    id: LOAN,
    themeId: TV_FERME,
    fromLudoId: VOISINE,
    toLudoId: LUDO,
    status: 'actif',
    createdAt: new Date('2026-06-15T09:00:00Z'),
  })

  // ─── Réseau : demandes d'aide ──────────────────────────────────────────────
  await db.insert(helpRequests).values([
    {
      id: HR_VOISINE,
      ludoId: VOISINE,
      date: '2026-07-04',
      slotInfo: 'Samedi matin, 9h-12h',
      notes: 'Il nous manque une personne pour l’ouverture.',
      status: 'ouverte',
      createdAt: new Date('2026-06-18T08:00:00Z'),
    },
    {
      id: HR_DEMO,
      ludoId: LUDO,
      date: '2026-07-11',
      slotInfo: 'Samedi après-midi, 14h-17h',
      notes: 'Renfort bienvenu pour l’animation Pirates.',
      status: 'ouverte',
      createdAt: new Date('2026-06-20T08:00:00Z'),
    },
    {
      id: HR_PAST,
      ludoId: LUDO,
      date: '2026-05-30',
      slotInfo: 'Samedi matin',
      status: 'pourvue',
      createdAt: new Date('2026-05-10T08:00:00Z'),
    },
  ])

  // Un·e volontaire de la voisine se propose sur la demande de `demo`
  // → la carte « à moi » de demo affiche la section Volontaires.
  await db.insert(helpResponses).values({
    id: HRESP,
    helpRequestId: HR_DEMO,
    memberId: MV_RESP,
    ludoId: VOISINE,
    status: 'propose',
    createdAt: new Date('2026-06-21T10:00:00Z'),
  })

  // ─── Jeux à acheter (game_wishes) ──────────────────────────────────────────
  await db.insert(gameWishes).values([
    {
      ludoId: LUDO,
      title: 'Les Aventuriers du Rail',
      link: 'https://www.daysofwonder.com/aventuriers-du-rail/',
      priceChf: 4990,
      status: 'souhaite',
      addedById: M_RESP,
      createdAt: new Date('2026-06-12T10:00:00Z'),
    },
    {
      ludoId: LUDO,
      title: 'Dixit',
      priceChf: 3500,
      status: 'souhaite',
      addedById: M_BENE,
      createdAt: new Date('2026-06-14T10:00:00Z'),
    },
    {
      ludoId: LUDO,
      title: 'Catan',
      priceChf: 5500,
      status: 'achete',
      addedById: M_RESP,
      buyerId: M_RESP,
      createdAt: new Date('2026-06-05T10:00:00Z'),
    },
  ])

  // ─── Matériel (supply_requests) ────────────────────────────────────────────
  // Le service trie par urgence décroissante : la « critique » apparaît en tête.
  await db.insert(supplyRequests).values([
    {
      ludoId: LUDO,
      memberId: M_RESP,
      name: 'Cartouches d’encre',
      urgency: 'critique',
      status: 'en_attente',
      notes: 'L’imprimante est à sec, plus moyen d’imprimer les plannings.',
      createdAt: new Date('2026-06-19T10:00:00Z'),
    },
    {
      ludoId: LUDO,
      memberId: M_BENE,
      name: 'Gobelets en carton',
      urgency: 'haute',
      status: 'commande',
      createdAt: new Date('2026-06-17T10:00:00Z'),
    },
    {
      ludoId: LUDO,
      memberId: M_RESP,
      name: 'Feutres pour tableau blanc',
      urgency: 'normale',
      status: 'en_attente',
      createdAt: new Date('2026-06-16T10:00:00Z'),
    },
    {
      ludoId: LUDO,
      memberId: M_BENE,
      name: 'Bâche de pique-nique',
      urgency: 'normale',
      status: 'recu',
      createdAt: new Date('2026-06-02T10:00:00Z'),
    },
  ])

  // ─── Notifications in-app ──────────────────────────────────────────────────
  // Couvre plusieurs domaines (→ plusieurs filtres) et au moins une « à traiter »
  // non lue (→ badge dans le shell + chip rouge sur la page).
  await db.insert(notifications).values([
    {
      recipientLudoId: LUDO,
      recipientMemberId: M_RESP,
      type: 'theme_request',
      severity: 'action_required',
      entityType: 'theme',
      entityId: T_PIRATES,
      title: 'Demande de prêt reçue',
      body: 'Ludothèque Voisine souhaite emprunter « Pirates des Caraïbes ».',
      isRead: false,
      createdAt: new Date('2026-06-22T11:00:00Z'),
    },
    {
      recipientLudoId: LUDO,
      recipientMemberId: null,
      type: 'help_response',
      severity: 'info',
      entityType: 'help_request',
      entityId: HR_DEMO,
      title: 'Une ludo se propose',
      body: 'Ludothèque Voisine se propose pour votre demande d’aide du 11 juillet.',
      isRead: false,
      createdAt: new Date('2026-06-21T10:05:00Z'),
    },
    {
      recipientLudoId: LUDO,
      recipientMemberId: M_RESP,
      type: 'supply_request',
      severity: 'action_required',
      entityType: 'supply',
      title: 'Nouvelle demande de matériel',
      body: '« Cartouches d’encre » a été demandé (urgence critique).',
      isRead: true,
      createdAt: new Date('2026-06-19T10:05:00Z'),
    },
    {
      recipientLudoId: LUDO,
      recipientMemberId: null,
      type: 'absence_approved',
      severity: 'info',
      entityType: 'absence',
      title: 'Absence approuvée',
      body: 'Votre demande de formation du 12 septembre a été approuvée.',
      isRead: true,
      createdAt: new Date('2026-06-15T10:00:00Z'),
    },
  ])

  // ─── Newsletter : public (contacts) + campagnes ────────────────────────────
  // Contacts fictifs (domaine `example.com` réservé → aucune PII réelle), répartis
  // en segments pour que le résumé « Famille 5 · Institution 1 · Partenaire 1 »
  // s'affiche, avec un désabonné et un rejeté (états réalistes de la liste).
  const NL_CREATED = new Date('2026-05-15T10:00:00Z')
  await db.insert(newsletterContacts).values([
    { id: NL_C[0], ludoId: LUDO, email: 'sophie.martin@example.com', firstName: 'Sophie', lastName: 'Martin', tag: 'famille', status: 'subscribed', source: 'import', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
    { id: NL_C[1], ludoId: LUDO, email: 'luca.rossi@example.com', firstName: 'Luca', lastName: 'Rossi', tag: 'famille', status: 'subscribed', source: 'import', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
    { id: NL_C[2], ludoId: LUDO, email: 'ines.dubois@example.com', firstName: 'Inès', lastName: 'Dubois', tag: 'famille', status: 'subscribed', source: 'import', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
    { id: NL_C[3], ludoId: LUDO, email: 'theo.nguyen@example.com', firstName: 'Théo', lastName: 'Nguyen', tag: 'famille', status: 'subscribed', source: 'manual', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
    { id: NL_C[4], ludoId: LUDO, email: 'lena.keller@example.com', firstName: 'Lena', lastName: 'Keller', tag: 'famille', status: 'subscribed', source: 'manual', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
    { id: NL_C[5], ludoId: LUDO, email: 'creche.arc-en-ciel@example.com', firstName: null, lastName: 'Crèche Arc-en-Ciel', tag: 'institution', status: 'subscribed', source: 'import', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
    { id: NL_C[6], ludoId: LUDO, email: 'librairie.desjeux@example.com', firstName: null, lastName: 'Librairie des Jeux', tag: 'partenaire', status: 'subscribed', source: 'manual', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
    { id: NL_C[7], ludoId: LUDO, email: 'marco.silva@example.com', firstName: 'Marco', lastName: 'Silva', tag: 'famille', status: 'unsubscribed', source: 'import', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
    { id: NL_C[8], ludoId: LUDO, email: 'paul.favre@example.com', firstName: 'Paul', lastName: 'Favre', tag: 'famille', status: 'bounced', source: 'import', unsubscribeToken: randomUUID(), createdAt: NL_CREATED }, // prettier-ignore
  ])

  // Une campagne envoyée (→ rapport d'envoi) + un brouillon en cours (→ éditeur).
  const CAMP_SENT_AT = new Date('2026-06-10T09:30:00Z')
  await db.insert(campaigns).values([
    {
      id: CAMP_DRAFT,
      ludoId: LUDO,
      subject: 'Les nouveautés de la rentrée',
      previewText: 'Trois nouveaux jeux et nos horaires de septembre.',
      content: {
        title: 'Trois nouveaux jeux à découvrir',
        body: 'Bonjour {{first_name}},\n\nLa rentrée approche, et avec elle de belles nouveautés à la ludothèque ! Nous avons ajouté trois jeux à notre catalogue, à emprunter dès le premier samedi de septembre.\n\nAu plaisir de vous revoir,\nL’équipe de la Ludothèque Démo',
        ctaLabel: 'Voir le catalogue',
        ctaUrl: 'https://ludohub.ch',
      },
      status: 'draft',
      createdAt: new Date('2026-06-22T10:00:00Z'),
    },
    {
      id: CAMP_SENT,
      ludoId: LUDO,
      subject: 'Programme d’été à la ludothèque',
      previewText: 'Nos horaires d’été et la fête de clôture du 28 juin.',
      content: {
        title: 'C’est bientôt l’été !',
        body: 'Bonjour {{first_name}},\n\nVoici nos horaires pour la période estivale, ainsi que l’invitation à notre fête de clôture le samedi 28 juin.\n\nBel été à toutes et tous,\nL’équipe de la Ludothèque Démo',
        ctaLabel: 'Voir le programme',
        ctaUrl: 'https://ludohub.ch',
      },
      status: 'sent',
      recipientCount: 6,
      sentAt: CAMP_SENT_AT,
      createdAt: new Date('2026-06-08T10:00:00Z'),
    },
  ])

  // Résultat d'envoi de la campagne « été » : 6 livrés + 1 rejet (c'est cet envoi
  // qui a fait passer Paul Favre en `bounced`). Alimente le rapport /[id]/stats.
  await db.insert(campaignSends).values([
    { campaignId: CAMP_SENT, contactId: NL_C[0], status: 'sent', createdAt: CAMP_SENT_AT },
    { campaignId: CAMP_SENT, contactId: NL_C[1], status: 'sent', createdAt: CAMP_SENT_AT },
    { campaignId: CAMP_SENT, contactId: NL_C[2], status: 'sent', createdAt: CAMP_SENT_AT },
    { campaignId: CAMP_SENT, contactId: NL_C[3], status: 'sent', createdAt: CAMP_SENT_AT },
    { campaignId: CAMP_SENT, contactId: NL_C[5], status: 'sent', createdAt: CAMP_SENT_AT },
    { campaignId: CAMP_SENT, contactId: NL_C[6], status: 'sent', createdAt: CAMP_SENT_AT },
    { campaignId: CAMP_SENT, contactId: NL_C[8], status: 'bounced', createdAt: CAMP_SENT_AT },
  ])

  console.log('✓ Tenant démo seedé : /demo (mdp demo2026)')
  console.log(`  Thème Pirates : /demo/themes/${T_PIRATES}`)
  console.log(`  Installation  : /demo/themes/${T_PIRATES}/installations/${INSTALL}`)
  console.log('✓ Ludo voisine seedée : /demo-voisine (catalogue + aide réseau)')
  console.log('  + jeux, matériel et notifications côté /demo')
  console.log(`  Newsletter : 9 contacts, 1 brouillon + 1 envoyée (rapport /demo/newsletter/${CAMP_SENT}/stats)`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Seed démo échoué :', err)
    process.exit(1)
  })
