import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadSitePhotoMigrationPlan,
  inspectSitePhotoReadiness,
  runSitePhotoMigration,
  sitePhotoApplyQueries,
  photoConstraintMatchesPlan,
  type PhotoMigrationDatabase,
  type PhotoSchemaState,
} from '../../../scripts/migration/site-photos-plan.js'

const neonMocks = vi.hoisted(() => ({ client: vi.fn(), transaction: vi.fn(), neon: vi.fn() }))
vi.mock('@neondatabase/serverless', () => ({ neon: neonMocks.neon }))
import { main, sitePhotoMigrationDatabase } from '../../../scripts/migration/migrate-site-photos.js'

const plan = loadSitePhotoMigrationPlan()
const prior = plan.prior.map((entry) => ({ hash: entry.hash, created_at: String(entry.timestamp) }))
const target = { hash: plan.target.hash, created_at: String(plan.target.timestamp) }
const ready: PhotoSchemaState = {
  basePresent: true,
  ledgerPresent: true,
  importantInfoPresent: true,
  photoColumns: [],
  photoConstraintPresent: false,
  photoConstraintDefinition: null,
}
const completed: PhotoSchemaState = {
  ...ready,
  photoConstraintPresent: true,
  photoConstraintDefinition: plan.target.statements[3].slice(
    plan.target.statements[3].indexOf('CHECK'),
  ),
  photoColumns: ['photo_url', 'photo_storage_key', 'photo_alt'].map((name) => ({
    name,
    dataType: 'text',
    nullable: 'YES',
  })),
}

beforeEach(() => {
  vi.clearAllMocks()
  neonMocks.neon.mockReturnValue(
    Object.assign(neonMocks.client, { transaction: neonMocks.transaction }),
  )
  neonMocks.client.mockImplementation((text, params) => ({ text, params }))
})

describe('migration ciblée 0020', () => {
  it('utilise exactement les métadonnées Drizzle locales et seulement les quatre évolutions photos', () => {
    expect(plan.prior).toHaveLength(20)
    expect(plan.target.tag).toBe('0020_site_photos')
    expect(plan.target.timestamp).toBe(1791792000000)
    expect(plan.target.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(plan.target.statements).toHaveLength(4)
    expect(plan.target.statements.join('\n')).not.toContain('DROP TABLE')
  })

  it('le préflight par défaut ne déclenche aucune écriture', async () => {
    const database: PhotoMigrationDatabase = {
      inspect: vi.fn().mockResolvedValue(ready),
      ledger: vi.fn().mockResolvedValue(prior),
      applyAtomic: vi.fn(),
    }
    await expect(runSitePhotoMigration(database, plan)).resolves.toBe('ready')
    expect(database.applyAtomic).not.toHaveBeenCalled()
  })

  it('refuse un socle ou ledger manquant avant de lire un ledger inexistant', async () => {
    const database: PhotoMigrationDatabase = {
      inspect: vi.fn().mockResolvedValue({ ...ready, ledgerPresent: false }),
      ledger: vi.fn(),
      applyAtomic: vi.fn(),
    }
    await expect(runSitePhotoMigration(database, plan, true)).rejects.toThrow('ledger')
    expect(database.ledger).not.toHaveBeenCalled()
    expect(database.applyAtomic).not.toHaveBeenCalled()
  })

  it('refuse un historique antérieur incomplet, dupliqué ou dont le hash diffère', () => {
    expect(() => inspectSitePhotoReadiness(plan, ready, prior.slice(1))).toThrow('0000')
    expect(() => inspectSitePhotoReadiness(plan, ready, [...prior, prior[0]])).toThrow(
      'exactement une fois',
    )
    expect(() =>
      inspectSitePhotoReadiness(plan, ready, [
        { ...prior[0], hash: 'different' },
        ...prior.slice(1),
      ]),
    ).toThrow('hash différent')
    expect(() =>
      inspectSitePhotoReadiness(plan, ready, [
        ...prior,
        { hash: 'future', created_at: 9999999999999 },
      ]),
    ).toThrow('inconnue')
  })

  it('refuse une application partielle et une migration marquée sans schéma complet', () => {
    expect(() =>
      inspectSitePhotoReadiness(
        plan,
        { ...ready, photoColumns: completed.photoColumns.slice(0, 1) },
        prior,
      ),
    ).toThrow('sans ledger')
    expect(() => inspectSitePhotoReadiness(plan, ready, [...prior, target])).toThrow('incomplet')
    expect(() =>
      inspectSitePhotoReadiness(plan, { ...completed, photoConstraintPresent: false }, [
        ...prior,
        target,
      ]),
    ).toThrow('incomplet')
    expect(() =>
      inspectSitePhotoReadiness(
        plan,
        {
          ...completed,
          photoColumns: completed.photoColumns.map((column) => ({
            ...column,
            dataType: 'integer',
          })),
        },
        [...prior, target],
      ),
    ).toThrow('incomplet')
  })

  it('une migration déjà appliquée est un noop même avec --apply', async () => {
    const database: PhotoMigrationDatabase = {
      inspect: vi.fn().mockResolvedValue(completed),
      ledger: vi.fn().mockResolvedValue([...prior, target]),
      applyAtomic: vi.fn(),
    }
    await expect(runSitePhotoMigration(database, plan, true)).resolves.toBe('already-applied')
    expect(database.applyAtomic).not.toHaveBeenCalled()
  })

  it('compare les groupements réels tout en tolérant le déparseur PostgreSQL', () => {
    const deparsed = `CHECK (((photo_alt IS NULL) AND (photo_url IS NULL) AND (photo_storage_key IS NULL)) OR
      ((photo_url IS NOT NULL) AND (char_length(btrim(photo_url)) >= 1) AND (char_length(btrim(photo_url)) <= 2000)
        AND (photo_storage_key IS NOT NULL) AND (char_length(TRIM(BOTH FROM photo_storage_key)) >= 1)
        AND (char_length(TRIM(BOTH FROM photo_storage_key)) <= 1000) AND (photo_alt IS NOT NULL)
        AND (pg_catalog.char_length(pg_catalog.btrim("photo_alt")) >= 1)
        AND (pg_catalog.char_length(pg_catalog.btrim("photo_alt")) <= 300)))`
    expect(photoConstraintMatchesPlan(plan, deparsed)).toBe(true)
    expect(
      photoConstraintMatchesPlan(
        plan,
        deparsed.toUpperCase().replaceAll('"PHOTO_ALT"', '"photo_alt"'),
      ),
    ).toBe(true)
    expect(photoConstraintMatchesPlan(plan, completed.photoConstraintDefinition)).toBe(true)
    expect(
      photoConstraintMatchesPlan(
        plan,
        `  ${completed.photoConstraintDefinition!.replace(/;$/, '')} ;  `,
      ),
    ).toBe(true)
    expect(
      inspectSitePhotoReadiness(plan, { ...completed, photoConstraintDefinition: deparsed }, [
        ...prior,
        target,
      ]),
    ).toBe('already-applied')
  })

  it.each([
    ['une contrainte permissive', 'CHECK (true)'],
    ['une définition absente', null],
    ['une borne différente', completed.photoConstraintDefinition!.replace('2000', '2001')],
    [
      'une colonne manquante',
      completed.photoConstraintDefinition!.replace('AND photo_alt IS NOT NULL', ''),
    ],
    [
      'une fonction différente',
      completed.photoConstraintDefinition!.replace(
        'char_length(trim(photo_url))',
        'char_length(photo_url)',
      ),
    ],
    [
      'une fonction homonyme non builtin',
      completed.photoConstraintDefinition!.replace(
        'char_length(trim(photo_url))',
        'public.char_length(trim(photo_url))',
      ),
    ],
    [
      'un opérateur modifié',
      completed.photoConstraintDefinition!.replace('photo_url IS NULL AND', 'photo_url IS NULL OR'),
    ],
    [
      'un regroupement modifié',
      completed.photoConstraintDefinition!.replace(
        '(photo_url IS NULL AND photo_storage_key IS NULL AND photo_alt IS NULL)',
        '(photo_url IS NULL AND photo_storage_key IS NULL) OR photo_alt IS NULL',
      ),
    ],
    ['un suffixe imprévu', `${completed.photoConstraintDefinition} NO INHERIT`],
  ])('refuse %s malgré le nom et le ledger conformes', (_label, definition) => {
    expect(photoConstraintMatchesPlan(plan, definition)).toBe(false)
    expect(() =>
      inspectSitePhotoReadiness(plan, { ...completed, photoConstraintDefinition: definition }, [
        ...prior,
        target,
      ]),
    ).toThrow('définition')
  })

  it('une contrainte modifiée bloque aussi --apply sans tentative de réparation', async () => {
    const database: PhotoMigrationDatabase = {
      inspect: vi
        .fn()
        .mockResolvedValue({ ...completed, photoConstraintDefinition: 'CHECK (true)' }),
      ledger: vi.fn().mockResolvedValue([...prior, target]),
      applyAtomic: vi.fn(),
    }
    await expect(runSitePhotoMigration(database, plan, true)).rejects.toThrow('définition')
    expect(database.applyAtomic).not.toHaveBeenCalled()
  })

  it('--apply transmet une seule transaction puis confirme le ledger et les colonnes', async () => {
    const database: PhotoMigrationDatabase = {
      inspect: vi.fn().mockResolvedValueOnce(ready).mockResolvedValueOnce(completed),
      ledger: vi
        .fn()
        .mockResolvedValueOnce(prior)
        .mockResolvedValueOnce([...prior, target]),
      applyAtomic: vi.fn(),
    }
    await expect(runSitePhotoMigration(database, plan, true)).resolves.toBe('applied')
    expect(database.applyAtomic).toHaveBeenCalledExactlyOnceWith(sitePhotoApplyQueries(plan))
  })

  it('la transaction verrouille et revérifie avant les seuls ALTER de 0020 et son ledger', () => {
    const queries = sitePhotoApplyQueries(plan)
    expect(queries[0].text).toContain('lock_timeout')
    expect(queries[2].text).toBe('SET LOCAL search_path = public')
    expect(queries[3].text).toBe('LOCK TABLE drizzle.__drizzle_migrations IN ACCESS EXCLUSIVE MODE')
    expect(queries[4].text).toBe('LOCK TABLE public.ludo_sites IN ACCESS EXCLUSIVE MODE')
    expect(queries[5].text).toContain('RAISE EXCEPTION')
    expect(queries[5].text).toContain('count(*) FROM drizzle.__drizzle_migrations')
    expect(queries[5].text).toContain('END; $site_photos$;')
    expect(queries.slice(6, 10).map((query) => query.text)).toEqual(plan.target.statements)
    expect(queries[10]).toEqual({
      text: 'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      params: [plan.target.hash, plan.target.timestamp],
    })
    expect(
      queries.some(
        (query) => query.text.startsWith('CREATE SCHEMA') || query.text.startsWith('CREATE TABLE'),
      ),
    ).toBe(false)
  })

  it('un échec atomique ne lance pas de seconde application ni de confirmation trompeuse', async () => {
    const failure = new Error('transaction rolled back')
    const database: PhotoMigrationDatabase = {
      inspect: vi.fn().mockResolvedValue(ready),
      ledger: vi.fn().mockResolvedValue(prior),
      applyAtomic: vi.fn().mockRejectedValue(failure),
    }
    await expect(runSitePhotoMigration(database, plan, true)).rejects.toBe(failure)
    expect(database.applyAtomic).toHaveBeenCalledTimes(1)
    expect(database.inspect).toHaveBeenCalledTimes(1)
  })

  it('l’adaptateur utilise des transactions READ ONLY pour les inspections et une transaction Serializable pour appliquer', async () => {
    neonMocks.transaction.mockResolvedValue([[ready]])
    const database = sitePhotoMigrationDatabase('postgresql://example.invalid/db')
    await database.inspect()
    expect(neonMocks.client.mock.calls[0][0]).toContain('pg_get_constraintdef(oid, false)')
    expect(neonMocks.client.mock.calls[0][0]).toContain('AS "photoConstraintDefinition"')
    expect(neonMocks.transaction.mock.calls[0][1]).toEqual({ readOnly: true })
    neonMocks.transaction.mockResolvedValue([prior])
    await database.ledger()
    expect(neonMocks.transaction.mock.calls[1][1]).toEqual({ readOnly: true })
    await database.applyAtomic(sitePhotoApplyQueries(plan))
    expect(neonMocks.transaction.mock.calls[2][1]).toEqual({ isolationLevel: 'Serializable' })
    expect(neonMocks.transaction.mock.calls[2][0]).toHaveLength(11)
  })

  it('--help et une option inconnue ne créent aucun client réseau', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    await main(['--help'])
    await expect(main(['--force'])).rejects.toThrow('Options invalides')
    expect(neonMocks.neon).not.toHaveBeenCalled()
    output.mockRestore()
  })
})
