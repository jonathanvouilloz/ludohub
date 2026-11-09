import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  chooseActor,
  planMissing,
  validateDocument,
  atStage,
  readOptions,
  safeImportDiagnostic,
  main,
} from './import-public-directory.js'

const document = JSON.parse(
  readFileSync(
    new URL('../../docs/data/geneva-directory-verified-2026-10-12.json', import.meta.url),
    'utf8',
  ),
)
const validated = validateDocument(document)

test('les douze contacts ont une provenance et Pré-Picot reste à Cologny dans le réseau Ville', () => {
  assert.equal(validated.entries.length, 12)
  const picot = validated.entries.find((entry) => entry.slug === 'pre-picot')!
  assert.equal(picot.city, 'Cologny')
  assert.equal(picot.address, 'Chemin de Pré-Picot 3')
  assert.equal(
    validated.entries.find((entry) => entry.slug === 'plainpalais-jonction')!.email,
    'ludo-jonction@bluewin.ch',
  )
  assert.throws(() => validateDocument({ ...document, tenant: 'demo' }))
  const duplicate = structuredClone(document)
  duplicate.entries[1].slug = duplicate.entries[0].slug
  assert.throws(() => validateDocument(duplicate))
})

test('ne choisit jamais une session navigateur ou un responsable ambigu', () => {
  const jonathan = { id: 'j', name: 'Jonathan Martin', role: 'responsable', is_active: true }
  const alessia = { id: 'a', name: 'Alessia', role: 'responsable', is_active: true }
  assert.equal(chooseActor([jonathan, alessia]).id, 'j')
  assert.throws(() => chooseActor([alessia]))
  assert.throws(() => chooseActor([jonathan, { ...jonathan, id: 'j2' }]))
  assert.equal(chooseActor([alessia], 'a').id, 'a')
  assert.throws(() => chooseActor([{ ...alessia, is_active: false }], 'a'))
})

test('préserve tous les slugs existants et construit les liens Maps à partir de l’adresse vérifiée', () => {
  const entries = planMissing(validated, [{ slug: 'pre-picot', sort_order: 87 }])
  assert.equal(entries.length, 11)
  assert.equal(
    entries.some((entry) => entry.slug === 'pre-picot'),
    false,
  )
  assert.equal(entries[0].sortOrder, 97)
  assert.ok(
    entries.every(
      (entry) =>
        new URL(entry.directionsUrl).searchParams.get('destination') ===
        `${entry.address}, ${entry.postalCode} ${entry.city}`,
    ),
  )
  assert.deepEqual(
    planMissing(
      validated,
      validated.entries.map((entry, index) => ({ slug: entry.slug, sort_order: index })),
    ),
    [],
  )
  assert.throws(() => planMissing(validated, [{ slug: 'custom', sort_order: 1000000 }]))
})

test('refuse les URLs de credentials, e-mails invalides et provenances manquantes', () => {
  for (const patch of [
    { officialUrl: 'https://user:password@example.com' },
    { email: 'invalid' },
    { sourceIds: ['unknown'] },
  ]) {
    const invalid = structuredClone(document)
    Object.assign(invalid.entries[0], patch)
    assert.throws(() => validateDocument(invalid))
  }
})

test('diagnostique exactement l’étape sans exposer erreur, paramètres ni URL du pilote', async () => {
  await assert.rejects(
    atStage('directory', async () => {
      throw new Error('postgres://user:super-secret@example.com/db; query parameter private')
    }),
    (cause: unknown) => {
      const diagnostic = safeImportDiagnostic(cause)
      assert.match(diagnostic, /étape « directory »/)
      assert.doesNotMatch(diagnostic, /super-secret|postgres:|query parameter/)
      return true
    },
  )
  assert.doesNotMatch(safeImportDiagnostic(new Error('super-secret')), /super-secret/)
})

test('un acteur ambigu indique la commande de diagnostic en lecture seule', async () => {
  await assert.rejects(
    atStage('actor', async () => chooseActor([])),
    (cause: unknown) => {
      assert.match(safeImportDiagnostic(cause), /étape « actor »/)
      assert.match(safeImportDiagnostic(cause), /--actor-id.*--list-actors/)
      return true
    },
  )
})

test('le mode list-actors reste exclusif à la lecture et aucun fichier de secrets n’est accepté', () => {
  assert.equal(readOptions(['--list-actors']).apply, false)
  assert.equal(readOptions(['--list-actors']).listActors, true)
  assert.throws(() => readOptions(['--list-actors', '--apply']))
  assert.throws(() => readOptions(['--list-actors', '--validate-only']))
  assert.throws(() => readOptions(['--env-file', '.env.production']))
})

test('validate-only valide sans dépendre de DATABASE_URL ni créer de client distant', async () => {
  const log = console.log
  const output: unknown[][] = []
  console.log = (...items: unknown[]) => {
    output.push(items)
  }
  try {
    await main(['--validate-only'])
    assert.match(String(output[0][0]), /Aucune connexion ni écriture/)
  } finally {
    console.log = log
  }
})
