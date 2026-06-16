/**
 * Seed dev — crée deux ludothèques de démo (« paquis » + « servette ») + membres.
 * Idempotent par slug : skip une ludo si son slug existe déjà.
 * La 2ᵉ ludo sert de destinataire pour les prêts de thèmes (réseau).
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

async function seedLudo(
  db: Db,
  ludo: { name: string; slug: string; password: string; color: string; address: string },
  membersList: Array<Pick<MemberInsert, 'name' | 'role' | 'isActive'>>,
) {
  const existing = await db.query.ludotheques.findFirst({
    where: eq(ludotheques.slug, ludo.slug),
  })
  if (existing) {
    console.log(`✓ Ludo « ${ludo.slug} » existe déjà (id ${existing.id}) — skip.`)
    return
  }

  const passwordHash = await hashPassword(ludo.password)
  const [created] = await db
    .insert(ludotheques)
    .values({
      name: ludo.name,
      slug: ludo.slug,
      passwordHash,
      color: ludo.color,
      address: ludo.address,
    })
    .returning()

  await db.insert(members).values(membersList.map((m) => ({ ...m, ludoId: created.id })))
  console.log(`✓ Ludo « ${ludo.slug} » créée (id ${created.id}) — mdp ${ludo.password}`)
}

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (.env)')

  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql, { schema })

  await seedLudo(
    db,
    {
      name: 'Ludothèque des Pâquis',
      slug: 'paquis',
      password: 'paquis2026',
      color: '#C0007A',
      address: 'Rue de Berne 1, 1201 Genève',
    },
    [
      { name: 'Alice Dupont', role: 'responsable', isActive: true },
      { name: 'Bruno Martin', role: 'member', isActive: true },
      { name: 'Clara Nguyen', role: 'member', isActive: true },
      { name: 'David Ancien', role: 'member', isActive: false },
    ],
  )

  await seedLudo(
    db,
    {
      name: 'Ludothèque de la Servette',
      slug: 'servette',
      password: 'servette2026',
      color: '#0073E6',
      address: 'Avenue Wendt 60, 1203 Genève',
    },
    [
      { name: 'Emma Rey', role: 'responsable', isActive: true },
      { name: 'Farid Benali', role: 'member', isActive: true },
    ],
  )
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Seed échoué :', err)
    process.exit(1)
  })
