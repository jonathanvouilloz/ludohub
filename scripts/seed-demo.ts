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
import { eq } from 'drizzle-orm'
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
  seasons,
  saturdaySlots,
  assignments,
  closurePeriods,
  seasonMemberSettings,
  absences,
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

  // 1. Reset du tenant demo. La FK `theme_installations.ludo_id → ludotheques`
  //    n'a PAS de cascade (une installation peut appartenir à une ludo emprunteuse),
  //    donc on supprime d'abord les installations du demo (cascade → items/check-ups
  //    via leurs FK installationId). Le reste part en cascade avec la ludo (slug).
  await db.delete(themeInstallations).where(eq(themeInstallations.ludoId, LUDO))
  await db.delete(ludotheques).where(eq(ludotheques.slug, 'demo'))

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

  console.log('✓ Tenant démo seedé : /demo (mdp demo2026)')
  console.log(`  Thème Pirates : /demo/themes/${T_PIRATES}`)
  console.log(`  Installation  : /demo/themes/${T_PIRATES}/installations/${INSTALL}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Seed démo échoué :', err)
    process.exit(1)
  })
