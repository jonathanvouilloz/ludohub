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

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (.env)')
  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql)

  // 1. Reset du tenant demo (cascade gère membres/thèmes/items/installations/check-ups).
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
