/**
 * Seed — crée les 12 ludothèques subventionnées de la Ville de Genève (FASE).
 * Données : fiches officielles Ville de Genève — voir docs/data/ludotheques-geneve.json.
 * Idempotent par slug : skip une ludo si son slug existe déjà.
 *
 * Chaque ludo reçoit son/sa responsable réel·le (rôle « responsable ») + 2 bénévoles
 * de démo, pour avoir de quoi tester planning / absences / swap.
 *
 * Mot de passe (dev) : `<slug>2026`. À faire tourner en prod via le reset password admin.
 *
 * Autonome : tourne sous tsx, hors runtime SvelteKit (pas de `$env`).
 * Lancer : pnpm db:seed
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { hashPassword } from 'better-auth/crypto'
import { ludotheques, members, type MemberInsert } from '../schema.js'

const schema = { ludotheques, members }
type Db = ReturnType<typeof drizzle<typeof schema>>

type LudoSeed = {
  name: string
  slug: string
  color: string
  address: string
  phone: string
  email: string
  website?: string
  /** Nom du/de la responsable (titre Mme/M. retiré) — devient un membre « responsable ». */
  responsable: string
}

/** Les 12 ludothèques. Couleurs d'accent distinctes (cf. DESIGN.md / dot réseau). */
const LUDOS: LudoSeed[] = [
  {
    name: 'Ludothèque 1-2-3 Planète',
    slug: '123-planete',
    color: '#0073E6',
    address: "Avenue d'Aïre 42, 1203 Genève",
    phone: '+41 22 344 06 52',
    email: 'ludoplanete@sunrise.ch',
    responsable: 'Diane Jolidon',
  },
  {
    name: 'Ludothèque des Eaux-Vives',
    slug: 'eaux-vives',
    color: '#00A86B',
    address: 'Rue du Nant 27, 1207 Genève',
    phone: '+41 22 735 36 26',
    email: 'ludo-ev@bluewin.ch',
    responsable: 'Cédric Nicolas',
  },
  {
    name: 'Ludothèque La Marelle',
    slug: 'marelle',
    color: '#E6007A',
    address: 'Route des Franchises 54A, 1203 Genève',
    phone: '+41 22 345 03 33',
    email: 'ludomarelle@bluewin.ch',
    responsable: 'David Abbet',
  },
  {
    name: 'Ludothèque de Saint-Jean',
    slug: 'saint-jean',
    color: '#F25C05',
    address: 'Rue de Saint-Jean 12, 1203 Genève',
    phone: '+41 22 344 07 00',
    email: 'ludo-stjean@bluewin.ch',
    website: 'https://www.ludo-stjean.ch',
    responsable: 'Jeanne Grand',
  },
  {
    name: 'Ludothèque Pré-Picot',
    slug: 'pre-picot',
    color: '#7B2FBF',
    address: 'Chemin Frank-Thomas 31, 1223 Cologny',
    phone: '+41 22 700 66 64',
    email: 'pre-picot@bluewin.ch',
    responsable: 'Rossella Rizzi',
  },
  {
    name: 'Ludothèque Prêt-Ludes',
    slug: 'pret-ludes',
    color: '#D62828',
    address: 'Rue Le-Corbusier 6, 1208 Genève',
    phone: '+41 22 346 46 86',
    email: 'ludo.pretludes@bluewin.ch',
    responsable: 'Rossella Rizzi',
  },
  {
    name: 'Ludothèque du Petit-Saconnex',
    slug: 'petit-saconnex',
    color: '#0EA5A5',
    address: 'Chemin des Genêts 14, 1202 Genève',
    phone: '+41 22 734 32 77',
    email: 'ludopetitsaconnex@bluewin.ch',
    responsable: 'Marina Gobet-Rampini',
  },
  {
    name: 'Ludothèque de la Servette',
    slug: 'servette',
    color: '#C0007A',
    address: 'Rue Jean-Robert-Chouet 8, 1202 Genève',
    phone: '+41 22 733 29 96',
    email: 'ludoservette@bluewin.ch',
    responsable: 'Nolwenn Pirossetti',
  },
  {
    name: 'Ludothèque des Pâquis',
    slug: 'paquis',
    color: '#1D3557',
    address: 'Rue de Berne 50, 1201 Genève',
    phone: '+41 22 731 20 09',
    email: 'lu.paquissecheron@fase.ch',
    responsable: 'Alessia Ditta',
  },
  {
    name: 'Ludothèque de Sécheron',
    slug: 'secheron',
    color: '#457B9D',
    address: 'Anne-Torcapel 2, 1202 Genève',
    phone: '+41 22 731 94 65',
    email: 'lu.paquissecheron@fase.ch',
    responsable: 'Alessia Ditta',
  },
  {
    name: 'Ludothèque Plainpalais-Jonction',
    slug: 'plainpalais-jonction',
    color: '#FB8500',
    address: 'Avenue de Sainte-Clotilde 1, 1205 Genève',
    phone: '+41 22 328 93 63',
    email: 'ludo-jonction@sunrise.ch',
    responsable: 'Christelle Badel',
  },
  {
    name: 'Ludothèque centre et vieille-ville',
    slug: 'centre-vieille-ville',
    color: '#6A994E',
    address: 'Rue Julienne-Piachaud 4, 1204 Genève',
    phone: '+41 22 310 19 08',
    email: 'ludocvv.ge@bluewin.ch',
    website: 'https://www.ludovieilleville.ch',
    responsable: 'Guillaume Tiran',
  },
]

async function seedLudo(db: Db, ludo: LudoSeed) {
  const existing = await db.query.ludotheques.findFirst({
    where: eq(ludotheques.slug, ludo.slug),
  })
  if (existing) {
    console.log(`✓ Ludo « ${ludo.slug} » existe déjà (id ${existing.id}) — skip.`)
    return
  }

  const password = `${ludo.slug}2026`
  const passwordHash = await hashPassword(password)
  const [created] = await db
    .insert(ludotheques)
    .values({
      name: ludo.name,
      slug: ludo.slug,
      passwordHash,
      color: ludo.color,
      address: ludo.address,
      phone: ludo.phone,
      email: ludo.email,
      website: ludo.website ?? null,
      responsible: ludo.responsable,
    })
    .returning()

  const membersList: Array<Pick<MemberInsert, 'name' | 'role' | 'isActive'>> = [
    { name: ludo.responsable, role: 'responsable', isActive: true },
    { name: 'Bénévole A', role: 'member', isActive: true },
    { name: 'Bénévole B', role: 'member', isActive: true },
  ]
  await db.insert(members).values(membersList.map((m) => ({ ...m, ludoId: created.id })))
  console.log(`✓ Ludo « ${ludo.slug} » créée (id ${created.id}) — mdp ${password}`)
}

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (.env)')

  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql, { schema })

  for (const ludo of LUDOS) {
    await seedLudo(db, ludo)
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Seed échoué :', err)
    process.exit(1)
  })
