/** Préflight protecteur avant drizzle-kit migrate. Ne crée jamais une base LudoHub vide. */
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (.env)')
  const sql = neon(process.env.DATABASE_URL)
  const rows = await sql`
    select
      to_regclass('public.ludotheques')::text as ludotheques,
      to_regclass('public.attendance_records')::text as attendance_records
  `
  const state = rows[0] as { ludotheques: string | null; attendance_records: string | null }
  if (!state?.ludotheques || !state.attendance_records) {
    throw new Error(
      'Migration refusée : la base ne contient pas le socle LudoHub attendu ' +
        '(ludotheques + attendance_records). Restaurez une sauvegarde ou utilisez une branche Neon existante.',
    )
  }

  console.log('✓ Préflight : socle LudoHub existant détecté.')
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle/migrations' })
  console.log('✓ Migrations SQL appliquées.')
}

main().catch((error) => {
  console.error('✗ Préflight migration échoué :', error)
  process.exitCode = 1
})
