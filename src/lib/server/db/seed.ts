/**
 * Seed dev — crée une ludothèque de démo « paquis » + membres.
 * Idempotent : skip si le slug existe déjà.
 *
 * Autonome : tourne sous tsx, hors runtime SvelteKit (pas de `$env`).
 * Lancer : pnpm db:seed
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { hashPassword } from 'better-auth/crypto'
import { ludotheques, members } from '../schema.js'

const SLUG = 'paquis'
const PASSWORD = 'paquis2026'

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (.env)')

  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql, { schema: { ludotheques, members } })

  const existing = await db.query.ludotheques.findFirst({ where: eq(ludotheques.slug, SLUG) })
  if (existing) {
    console.log(`✓ Ludo « ${SLUG} » existe déjà (id ${existing.id}) — skip.`)
    return
  }

  const passwordHash = await hashPassword(PASSWORD)
  const [ludo] = await db
    .insert(ludotheques)
    .values({
      name: 'Ludothèque des Pâquis',
      slug: SLUG,
      passwordHash,
      color: '#C0007A',
      address: 'Rue de Berne 1, 1201 Genève',
    })
    .returning()

  await db.insert(members).values([
    { ludoId: ludo.id, name: 'Alice Dupont', role: 'responsable', isActive: true },
    { ludoId: ludo.id, name: 'Bruno Martin', role: 'member', isActive: true },
    { ludoId: ludo.id, name: 'Clara Nguyen', role: 'member', isActive: true },
    { ludoId: ludo.id, name: 'David Ancien', role: 'member', isActive: false },
  ])

  console.log(`✓ Ludo « ${SLUG} » créée (id ${ludo.id})`)
  console.log(`  Mot de passe : ${PASSWORD}`)
  console.log(`  3 membres actifs + 1 inactif (David Ancien, ne doit pas apparaître).`)
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Seed échoué :', err)
    process.exit(1)
  })
