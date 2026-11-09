/** Runtime DATABASE_URL only: never loads .env, prints a secret or runs previous migrations. */
import { neon } from '@neondatabase/serverless'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadSitePhotoMigrationPlan,
  runSitePhotoMigration,
  SitePhotoMigrationError,
  type PhotoMigrationDatabase,
  type PhotoSchemaState,
  type LedgerRow,
} from './site-photos-plan.js'

export function sitePhotoMigrationDatabase(databaseUrl: string): PhotoMigrationDatabase {
  const client = neon(databaseUrl)
  const readOnly = async (query: string) => {
    const [rows] = await client.transaction([client(query, [])], { readOnly: true })
    return rows
  }
  return {
    inspect: async () => {
      const [row] = await readOnly(`SELECT
        (to_regclass('public.ludotheques') IS NOT NULL AND to_regclass('public.attendance_records') IS NOT NULL
          AND to_regclass('public.ludo_sites') IS NOT NULL) AS "basePresent",
        to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS "ledgerPresent",
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
          AND table_name = 'ludo_sites' AND column_name = 'important_info') AS "importantInfoPresent",
        (SELECT coalesce(json_agg(json_build_object('name', column_name, 'dataType', data_type, 'nullable', is_nullable)), '[]'::json)
          FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ludo_sites'
          AND column_name IN ('photo_url', 'photo_storage_key', 'photo_alt')) AS "photoColumns",
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.ludo_sites')
          AND conname = 'ludo_sites_photo_check' AND contype = 'c' AND convalidated) AS "photoConstraintPresent",
        (SELECT pg_get_constraintdef(oid, false) FROM pg_constraint
          WHERE conrelid = to_regclass('public.ludo_sites') AND conname = 'ludo_sites_photo_check'
          AND contype = 'c' AND convalidated) AS "photoConstraintDefinition"`)
      if (!row) throw new SitePhotoMigrationError('Le préflight ne retourne aucun état de schéma.')
      return row as PhotoSchemaState
    },
    ledger: async () =>
      (await readOnly(
        'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at',
      )) as LedgerRow[],
    applyAtomic: async (queries) => {
      await client.transaction(
        queries.map((query) => client(query.text, query.params)),
        { isolationLevel: 'Serializable' },
      )
    },
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('pnpm exec tsx scripts/migration/migrate-site-photos.ts [--apply]')
    console.log(
      'Sans option : préflight en lecture seule. --apply : uniquement 0020, atomiquement avec le ledger.',
    )
    console.log('DATABASE_URL doit être injectée dans le processus. Aucun fichier .env n’est lu.')
    return
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply'))
    throw new SitePhotoMigrationError(
      'Options invalides. Seule --apply est autorisée ; --help affiche l’aide.',
    )
  if (!process.env.DATABASE_URL)
    throw new SitePhotoMigrationError(
      'DATABASE_URL doit être injectée dans l’environnement du processus.',
    )
  const plan = loadSitePhotoMigrationPlan()
  const status = await runSitePhotoMigration(
    sitePhotoMigrationDatabase(process.env.DATABASE_URL),
    plan,
    args[0] === '--apply',
  )
  console.log(
    status === 'ready'
      ? 'Préflight validé : 0000–0019 enregistrées, 0020 prête. Aucune écriture effectuée.'
      : status === 'already-applied'
        ? '0020 déjà appliquée et schéma photos confirmé. Aucune écriture effectuée.'
        : '0020 appliquée : colonnes, contrainte et ledger confirmés.',
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause: unknown) => {
    if (cause instanceof SitePhotoMigrationError) console.error(cause.message)
    else {
      const code =
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        typeof cause.code === 'string' &&
        /^[A-Z0-9]{5}$/.test(cause.code)
          ? ` (code ${cause.code})`
          : ''
      console.error(
        `Migration interrompue${code}. Relancez le préflight avant toute nouvelle application.`,
      )
    }
    process.exitCode = 1
  })
}
