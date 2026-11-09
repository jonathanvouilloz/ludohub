import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'

export class SitePhotoMigrationError extends Error {}
export type MigrationEntry = { tag: string; hash: string; timestamp: number; statements: string[] }
export type SitePhotoMigrationPlan = { prior: MigrationEntry[]; target: MigrationEntry }
export type LedgerRow = { hash: string; created_at: string | number }
export type PhotoSchemaState = {
  basePresent: boolean
  ledgerPresent: boolean
  importantInfoPresent: boolean
  photoColumns: Array<{ name: string; dataType: string; nullable: string }>
  photoConstraintPresent: boolean
  photoConstraintDefinition: string | null
}
export type MigrationQuery = { text: string; params: Array<string | number> }
export type PhotoMigrationDatabase = {
  inspect: () => Promise<PhotoSchemaState>
  ledger: () => Promise<LedgerRow[]>
  applyAtomic: (queries: MigrationQuery[]) => Promise<void>
}

type CheckNode = { kind: string; value?: string; children?: CheckNode[] }

/**
 * Compares this small CHECK structurally, not by deleting parentheses from SQL.
 * PostgreSQL can expand BETWEEN and deparse trim() as btrim() or TRIM(BOTH FROM).
 * Everything outside the expected grammar is rejected, never evaluated as SQL.
 */
function canonicalPhotoCheck(definition: string): string | null {
  const source = definition.trim().replace(/;$/, '').trim()
  const tokens: string[] = []
  let offset = 0
  const tokenPattern = /\s*("(?:[^"]|"")*"|[a-z_][a-z0-9_]*|\d+|>=|<=|[(),.])/iy
  while (offset < source.length) {
    tokenPattern.lastIndex = offset
    const match = tokenPattern.exec(source)
    if (!match) return null
    tokens.push(
      match[1].startsWith('"')
        ? match[1].slice(1, -1).replaceAll('""', '"')
        : match[1].toLowerCase(),
    )
    offset = tokenPattern.lastIndex
  }
  let position = 0
  const take = (expected?: string) => {
    const token = tokens[position++]
    if (token === undefined || (expected !== undefined && token !== expected))
      throw new Error('Unexpected CHECK token')
    return token
  }
  const peek = () => tokens[position]
  const group = (kind: 'and' | 'or', children: CheckNode[]): CheckNode => ({
    kind,
    children: children.flatMap((child) => (child.kind === kind ? child.children! : [child])),
  })
  const scalar = (): CheckNode => {
    if (peek() === '(') {
      take('(')
      const value = scalar()
      take(')')
      return value
    }
    let name = take()
    if (/^\d+$/.test(name)) return { kind: 'number', value: String(Number(name)) }
    if (name === 'pg_catalog' && peek() === '.') {
      take('.')
      name = take()
    }
    if (['photo_url', 'photo_storage_key', 'photo_alt'].includes(name))
      return { kind: 'column', value: name }
    if (!['char_length', 'trim', 'btrim'].includes(name))
      throw new Error('Unexpected CHECK identifier')
    take('(')
    if (name === 'trim' && peek() === 'both') {
      take('both')
      take('from')
    }
    const argument = scalar()
    take(')')
    return { kind: name === 'btrim' ? 'trim' : name, children: [argument] }
  }
  const predicate = (): CheckNode => {
    // Parentheses can enclose either a boolean expression or a comparison operand.
    if (peek() === '(') {
      const checkpoint = position
      try {
        take('(')
        const expression = or()
        take(')')
        return expression
      } catch {
        position = checkpoint
      }
    }
    const left = scalar()
    const operator = take()
    if (operator === 'is') {
      const negated = peek() === 'not'
      if (negated) take('not')
      take('null')
      return { kind: negated ? 'not-null' : 'null', children: [left] }
    }
    if (operator === 'between') {
      const low = scalar()
      take('and')
      const high = scalar()
      return group('and', [
        { kind: '>=', children: [left, low] },
        { kind: '<=', children: [left, high] },
      ])
    }
    if (operator !== '>=' && operator !== '<=') throw new Error('Unexpected CHECK comparison')
    return { kind: operator, children: [left, scalar()] }
  }
  const and = (): CheckNode => {
    const children = [predicate()]
    while (peek() === 'and') {
      take('and')
      children.push(predicate())
    }
    return children.length === 1 ? children[0] : group('and', children)
  }
  const or = (): CheckNode => {
    const children = [and()]
    while (peek() === 'or') {
      take('or')
      children.push(and())
    }
    return children.length === 1 ? children[0] : group('or', children)
  }
  const serialize = (node: CheckNode): string => {
    const children = node.children?.map(serialize) ?? []
    if (node.kind === 'and' || node.kind === 'or') children.sort()
    return JSON.stringify([node.kind, node.value ?? null, children])
  }
  try {
    take('check')
    take('(')
    const expression = or()
    take(')')
    if (position !== tokens.length) return null
    return serialize(expression)
  } catch {
    return null
  }
}

export function photoConstraintMatchesPlan(
  plan: SitePhotoMigrationPlan,
  definition: string | null,
) {
  const statement = plan.target.statements.find((sql) =>
    sql.includes('ADD CONSTRAINT "ludo_sites_photo_check" CHECK'),
  )
  if (!statement || typeof definition !== 'string') return false
  const expected = canonicalPhotoCheck(statement.slice(statement.indexOf('CHECK')))
  const actual = canonicalPhotoCheck(definition)
  return expected !== null && actual !== null && expected === actual
}

/** Reads exactly the same hashes and timestamps as the installed Drizzle migrator. */
export function loadSitePhotoMigrationPlan(): SitePhotoMigrationPlan {
  const folder = fileURLToPath(new URL('../../drizzle/migrations/', import.meta.url))
  const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, 'utf8')) as {
    entries: Array<{ idx: number; tag: string; when: number }>
  }
  const migrations = readMigrationFiles({ migrationsFolder: folder })
  const targetIndex = journal.entries.findIndex((entry) => entry.tag === '0020_site_photos')
  if (targetIndex !== 20 || journal.entries.length !== migrations.length)
    throw new SitePhotoMigrationError(
      'Le journal ne correspond pas à la migration photos 0020 attendue.',
    )
  const entries = journal.entries.slice(0, targetIndex + 1).map((entry, index) => {
    const migration = migrations[index]
    if (
      entry.idx !== index ||
      !Number.isSafeInteger(entry.when) ||
      entry.when !== migration.folderMillis ||
      !/^[a-f0-9]{64}$/.test(migration.hash) ||
      (index > 0 && entry.when <= journal.entries[index - 1].when)
    )
      throw new SitePhotoMigrationError('Historique local de migrations incohérent.')
    return {
      tag: entry.tag,
      hash: migration.hash,
      timestamp: migration.folderMillis,
      statements: migration.sql.map((statement) => statement.trim()).filter(Boolean),
    }
  })
  const target = entries[targetIndex]
  if (
    target.statements.length !== 4 ||
    target.statements.some((statement) => !statement.startsWith('ALTER TABLE "ludo_sites" '))
  )
    throw new SitePhotoMigrationError(
      'La migration 0020 ne contient pas les quatre évolutions photos attendues.',
    )
  return { prior: entries.slice(0, targetIndex), target }
}

export function inspectSitePhotoReadiness(
  plan: SitePhotoMigrationPlan,
  schema: PhotoSchemaState,
  ledger: LedgerRow[],
) {
  if (!schema.basePresent || !schema.ledgerPresent || !schema.importantInfoPresent)
    throw new SitePhotoMigrationError(
      'Socle LudoHub, ledger Drizzle ou migration 0018 absent. Aucune migration automatique possible.',
    )
  const expected = [...plan.prior, plan.target]
  for (const row of ledger) {
    if (
      !expected.some(
        (entry) => entry.timestamp === Number(row.created_at) && entry.hash === row.hash,
      )
    )
      throw new SitePhotoMigrationError(
        'Le ledger contient une migration inconnue ou un hash différent. Vérification manuelle requise.',
      )
  }
  for (const entry of plan.prior) {
    if (
      ledger.filter((row) => Number(row.created_at) === entry.timestamp && row.hash === entry.hash)
        .length !== 1
    )
      throw new SitePhotoMigrationError(
        `Migration antérieure non enregistrée exactement une fois : ${entry.tag}.`,
      )
  }
  const targetRecords = ledger.filter((row) => Number(row.created_at) === plan.target.timestamp)
  if (targetRecords.length > 1)
    throw new SitePhotoMigrationError('Migration photos enregistrée plusieurs fois dans le ledger.')
  if (targetRecords.length === 1) {
    const names = ['photo_url', 'photo_storage_key', 'photo_alt']
    if (
      schema.photoColumns.length !== 3 ||
      !schema.photoConstraintPresent ||
      names.some(
        (name) =>
          !schema.photoColumns.some(
            (column) =>
              column.name === name && column.dataType === 'text' && column.nullable === 'YES',
          ),
      )
    )
      throw new SitePhotoMigrationError(
        '0020 est enregistrée mais le schéma photos est incomplet. Réparation manuelle requise.',
      )
    if (!photoConstraintMatchesPlan(plan, schema.photoConstraintDefinition))
      throw new SitePhotoMigrationError(
        '0020 est enregistrée mais la définition de sa contrainte photos diffère. Réparation manuelle requise.',
      )
    return 'already-applied' as const
  }
  if (schema.photoColumns.length || schema.photoConstraintPresent)
    throw new SitePhotoMigrationError(
      'Des éléments photos existent sans ledger 0020. Aucun ajout partiel ou rattrapage automatique.',
    )
  return 'ready' as const
}

/** Recheck all prerequisites under table locks, in the same transaction as DDL + ledger. */
export function sitePhotoApplyQueries(plan: SitePhotoMigrationPlan): MigrationQuery[] {
  const expected = plan.prior
    .map((entry) => `('${entry.hash}', ${entry.timestamp}::bigint)`)
    .join(',\n')
  const guard = `DO $site_photos$
  BEGIN
    IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> ${plan.prior.length}
      OR EXISTS (
        SELECT 1 FROM (VALUES ${expected}) AS expected(hash, created_at)
        WHERE (SELECT count(*) FROM drizzle.__drizzle_migrations ledger
          WHERE ledger.hash = expected.hash AND ledger.created_at = expected.created_at) <> 1
      ) THEN RAISE EXCEPTION 'Migration photos refusée : historique Drizzle modifié ou incomplet'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ludo_sites' AND column_name = 'important_info')
      OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name = 'ludo_sites' AND column_name IN ('photo_url', 'photo_storage_key', 'photo_alt'))
      OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ludo_sites'::regclass
        AND conname = 'ludo_sites_photo_check')
      THEN RAISE EXCEPTION 'Migration photos refusée : schéma modifié depuis le préflight'; END IF;
  END; $site_photos$;`
  return [
    { text: "SET LOCAL lock_timeout = '5s'", params: [] },
    { text: "SET LOCAL statement_timeout = '30s'", params: [] },
    { text: 'SET LOCAL search_path = public', params: [] },
    { text: 'LOCK TABLE drizzle.__drizzle_migrations IN ACCESS EXCLUSIVE MODE', params: [] },
    { text: 'LOCK TABLE public.ludo_sites IN ACCESS EXCLUSIVE MODE', params: [] },
    { text: guard, params: [] },
    ...plan.target.statements.map((text) => ({ text, params: [] })),
    {
      text: 'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      params: [plan.target.hash, plan.target.timestamp],
    },
  ]
}

export async function runSitePhotoMigration(
  database: PhotoMigrationDatabase,
  plan: SitePhotoMigrationPlan,
  apply = false,
) {
  const schema = await database.inspect()
  if (!schema.ledgerPresent || !schema.basePresent)
    throw new SitePhotoMigrationError(
      'Socle LudoHub ou ledger Drizzle absent. Préflight arrêté sans écriture.',
    )
  const status = inspectSitePhotoReadiness(plan, schema, await database.ledger())
  if (!apply || status === 'already-applied') return status
  await database.applyAtomic(sitePhotoApplyQueries(plan))
  const confirmed = inspectSitePhotoReadiness(
    plan,
    await database.inspect(),
    await database.ledger(),
  )
  if (confirmed !== 'already-applied')
    throw new SitePhotoMigrationError(
      'Transaction terminée sans confirmation de 0020. Relancez le préflight.',
    )
  return 'applied' as const
}
