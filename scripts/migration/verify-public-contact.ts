/** Read-only, receipt-scoped verification. Never loads .env or returns contact personal data. */
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const TENANT = 'paquis-secheron'
export function readOptions(args: string[]) {
  const options: {
    receiptId?: string
    subject?: string
    marker?: string
    key?: string
    help: boolean
  } = {
    help: false,
  }
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (flag === '--help' && args.length === 1) return { ...options, help: true }
    if (!['--receipt-id', '--subject', '--marker', '--idempotency-key'].includes(flag))
      throw new Error('Options invalides.')
    const value = args[++index]
    if (!value || value.startsWith('--')) throw new Error('Valeur manquante.')
    if (flag === '--receipt-id') options.receiptId = value
    else if (flag === '--subject') options.subject = value
    else if (flag === '--marker') options.marker = value
    else options.key = value
  }
  if (
    options.receiptId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      options.receiptId,
    )
  )
    throw new Error('Identifiant de reçu UUID requis.')
  if (Boolean(options.receiptId) === Boolean(options.subject))
    throw new Error('Indiquez un reçu ou un sujet exact, exclusivement.')
  if (
    options.subject &&
    (options.subject.trim() !== options.subject ||
      options.subject.length > 200 ||
      /[\x00-\x1f]/.test(options.subject))
  )
    throw new Error('Sujet exact invalide.')
  if (
    !options.marker ||
    options.marker.length < 8 ||
    options.marker.length > 200 ||
    /[\x00-\x1f]/.test(options.marker)
  )
    throw new Error('Marqueur explicite de 8 à 200 caractères requis.')
  if (
    options.key &&
    (options.key.length < 16 || options.key.length > 200 || !/^[\x21-\x7e]+$/.test(options.key))
  )
    throw new Error('Clé d’idempotence invalide.')
  return options
}

type ReceiptVerification = {
  receipt_id: string | null
  status: string | null
  receipt_rows: number
  scoped_key_rows: number
  key_hash_valid: boolean
  subject_matches: boolean
  message_matches: boolean
  expected_key_matches: boolean | null
}
export function receiptVerified(row: ReceiptVerification | undefined) {
  return (
    row?.receipt_rows === 1 &&
    row.scoped_key_rows === 1 &&
    row.key_hash_valid === true &&
    row.subject_matches === true &&
    row.message_matches === true &&
    row.expected_key_matches !== false
  )
}

export async function main(args = process.argv.slice(2)) {
  const options = readOptions(args)
  if (options.help) {
    console.log(
      'pnpm exec tsx scripts/migration/verify-public-contact.ts (--receipt-id UUID | --subject SUJET_EXACT) --marker MARQUEUR [--idempotency-key CLE]',
    )
    console.log(
      'Recherche limitée au reçu, ou au sujet exact avec marqueur du message. Lecture seule Pâquis-Sécheron, aucun contenu ni secret affiché.',
    )
    return
  }
  if (!process.env.DATABASE_URL)
    throw new Error(
      'DATABASE_URL doit être injectée dans le processus ; aucun fichier .env n’est lu.',
    )
  const client = neon(process.env.DATABASE_URL)
  const expectedHash = options.key ? createHash('sha256').update(options.key).digest('hex') : null
  const [rows] = await client.transaction(
    [
      client(
        `
    WITH target AS (
      SELECT c.id, c.status, c.ludo_id, c.idempotency_key_hash,
        CASE WHEN $5::text IS NULL THEN strpos(c.subject, $3) > 0 ELSE c.subject = $5::text END AS subject_matches,
        strpos(c.message, $3) > 0 AS message_matches
      FROM public.public_contact_messages c
      JOIN public.ludotheques l ON l.id = c.ludo_id
      WHERE l.slug = $2 AND (
        ($1::uuid IS NOT NULL AND c.id = $1::uuid)
        OR ($1::uuid IS NULL AND c.subject = $5::text AND strpos(c.message, $3) > 0)
      )
    )
    SELECT (SELECT count(*)::integer FROM target) AS receipt_rows,
      (SELECT count(*)::integer FROM public.public_contact_messages c
        JOIN target t ON t.ludo_id = c.ludo_id AND t.idempotency_key_hash = c.idempotency_key_hash) AS scoped_key_rows,
      CASE WHEN (SELECT count(*) FROM target) = 1 THEN (SELECT id::text FROM target) ELSE NULL END AS receipt_id,
      CASE WHEN (SELECT count(*) FROM target) = 1 THEN (SELECT status::text FROM target) ELSE NULL END AS status,
      coalesce((SELECT bool_and(idempotency_key_hash ~ '^[a-f0-9]{64}$') FROM target), false) AS key_hash_valid,
      coalesce((SELECT bool_and(subject_matches) FROM target), false) AS subject_matches,
      coalesce((SELECT bool_and(message_matches) FROM target), false) AS message_matches,
      CASE WHEN $4::text IS NULL THEN NULL ELSE coalesce((SELECT bool_and(idempotency_key_hash = $4::text) FROM target), false) END AS expected_key_matches
  `,
        [options.receiptId ?? null, TENANT, options.marker, expectedHash, options.subject ?? null],
      ),
    ],
    { readOnly: true },
  )
  const row = rows[0] as ReceiptVerification | undefined
  console.log(
    JSON.stringify({
      tenant: TENANT,
      readOnly: true,
      receiptRows: row?.receipt_rows ?? 0,
      receiptId: row?.receipt_id ?? null,
      status: row?.status ?? null,
      sameTenantSameKeyRows: row?.scoped_key_rows ?? 0,
      keyHashValid: row?.key_hash_valid === true,
      subjectMarkerMatches: row?.subject_matches === true,
      messageMarkerMatches: row?.message_matches === true,
      expectedKeyMatches: row?.expected_key_matches ?? null,
      verified: receiptVerified(row),
    }),
  )
  if (!receiptVerified(row)) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Raw driver errors may contain SQL, parameters and credentials.
    console.error(
      'Vérification du reçu interrompue. Vérifiez les options, la connexion injectée et le schéma ; aucun contenu de contact ni secret n’est affiché.',
    )
    process.exitCode = 1
  })
}
