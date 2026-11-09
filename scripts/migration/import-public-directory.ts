/**
 * Import additif de l'annuaire Ville de Genève, exclusivement dans Pâquis-Sécheron.
 * pnpm exec tsx scripts/migration/import-public-directory.ts --validate-only
 * Injecter DATABASE_URL dans le processus pour la simulation distante, sans exporter de secrets.
 * Ajouter --apply pour publier les entrées manquantes. Les lignes existantes restent intactes.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

export const TENANT = 'paquis-secheron'
const DEFAULT_DATA = new URL(
  '../../docs/data/geneva-directory-verified-2026-10-12.json',
  import.meta.url,
)
type Entry = {
  slug: string
  name: string
  address: string
  postalCode: string
  city: string
  phone: string
  email: string
  website: string | null
  officialUrl: string
  networkCity: string
  verifiedAt: string
  sourceIds: string[]
  verificationNotes: string
}
type Document = {
  version: number
  tenant: string
  networkCity: string
  verifiedAt: string
  sources: { id: string; url: string; retrieval: string }[]
  entries: Entry[]
}
type Member = { id: string; name: string; role: string; is_active: boolean }
type Existing = { slug: string; sort_order: number }

const STAGE_HINTS = {
  options: 'Vérifiez les options du script.',
  document: 'Vérifiez le document local et ses provenances.',
  environment: 'DATABASE_URL doit être injectée dans le processus ; aucun fichier .env n’est lu.',
  connection: 'Vérifiez la configuration de connexion injectée.',
  tenant: 'Vérifiez le tenant Pâquis-Sécheron, le module public et son schéma.',
  actors: 'La lecture des responsables actifs du tenant a échoué.',
  actor:
    'Indiquez --actor-id avec un responsable actif du tenant ; --list-actors les affiche sans écriture. Jonathan doit être unique pour la sélection automatique.',
  directory: 'La lecture de l’annuaire a échoué ; vérifiez les migrations et permissions.',
  plan: 'Le plan d’import ne respecte pas les limites de l’annuaire.',
  apply: 'Application non confirmée : relancez la simulation avant tout nouvel essai.',
  authorization: 'Autorisation modifiée au moment de l’écriture ; aucune création autorisée.',
} as const
export class DirectoryImportStageError extends Error {
  constructor(public readonly stage: keyof typeof STAGE_HINTS) {
    super(
      `Import interrompu à l’étape « ${stage} ». ${STAGE_HINTS[stage]} Aucun secret n’est affiché.`,
    )
  }
}
export async function atStage<T>(
  stage: keyof typeof STAGE_HINTS,
  operation: () => T | PromiseLike<T>,
): Promise<T> {
  try {
    return await operation()
  } catch {
    throw new DirectoryImportStageError(stage)
  }
}
export function safeImportDiagnostic(cause: unknown) {
  return cause instanceof DirectoryImportStageError
    ? cause.message
    : 'Import interrompu à une étape non identifiée. Aucun détail du pilote ni secret n’est affiché.'
}

const validUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2000) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}
const boundedText = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= maximum

export function validateDocument(input: unknown): Document {
  if (!input || typeof input !== 'object') throw new Error('Document d’annuaire invalide.')
  const doc = input as Document
  if (
    doc.version !== 1 ||
    doc.tenant !== TENANT ||
    doc.networkCity !== 'Ville de Genève' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(doc.verifiedAt) ||
    !Array.isArray(doc.entries) ||
    doc.entries.length !== 12 ||
    !Array.isArray(doc.sources) ||
    !doc.sources.length
  )
    throw new Error('Périmètre ou provenance du document invalide.')
  const sourceIds = new Set<string>()
  for (const source of doc.sources) {
    if (
      !boundedText(source.id, 80) ||
      sourceIds.has(source.id) ||
      !validUrl(source.url) ||
      !boundedText(source.retrieval, 200)
    )
      throw new Error('Source de vérification invalide.')
    sourceIds.add(source.id)
  }
  const slugs = new Set<string>()
  for (const entry of doc.entries) {
    if (
      !boundedText(entry.slug, 180) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
      slugs.has(entry.slug) ||
      !boundedText(entry.name, 180) ||
      !boundedText(entry.address, 500) ||
      !boundedText(entry.postalCode, 20) ||
      !boundedText(entry.city, 100) ||
      !boundedText(entry.phone, 50) ||
      !/^\+41 \d{2} \d{3} \d{2} \d{2}$/.test(entry.phone) ||
      !boundedText(entry.email, 320) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email) ||
      !validUrl(entry.officialUrl) ||
      (entry.website !== null && !validUrl(entry.website)) ||
      entry.networkCity !== doc.networkCity ||
      entry.verifiedAt !== doc.verifiedAt ||
      !boundedText(entry.verificationNotes, 2000) ||
      !Array.isArray(entry.sourceIds) ||
      !entry.sourceIds.length ||
      entry.sourceIds.some((id) => !sourceIds.has(id))
    )
      throw new Error(`Entrée ou provenance invalide : ${entry.slug ?? 'sans slug'}.`)
    slugs.add(entry.slug)
  }
  return doc
}

export function chooseActor(members: Member[], actorId?: string): Member {
  const authorized = members.filter((member) => member.is_active && member.role === 'responsable')
  const candidates = actorId
    ? authorized.filter((member) => member.id === actorId)
    : authorized.filter((member) => /(^|\s)jonathan(\s|$)/i.test(member.name.trim()))
  if (candidates.length !== 1)
    throw new Error(
      'Indiquez --actor-id avec un responsable actif du seul espace Pâquis-Sécheron; Jonathan doit être unique pour une sélection automatique.',
    )
  return candidates[0]
}

export function planMissing(doc: Document, existing: Existing[]) {
  const present = new Set(existing.map((entry) => entry.slug))
  const base = Math.max(-10, ...existing.map((entry) => entry.sort_order)) + 10
  const planned = doc.entries
    .filter((entry) => !present.has(entry.slug))
    .map((entry, index) => {
      const sortOrder = base + index * 10
      if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000000)
        throw new Error('Ordre de publication hors des limites du schéma.')
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${entry.address}, ${entry.postalCode} ${entry.city}`)}`
      return { ...entry, sortOrder, directionsUrl }
    })
  return planned
}

export function readOptions(args: string[]) {
  const options: {
    apply: boolean
    validateOnly: boolean
    listActors: boolean
    actorId?: string
    dataFile?: string
  } = { apply: false, validateOnly: false, listActors: false }
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (flag === '--apply') options.apply = true
    else if (flag === '--validate-only') options.validateOnly = true
    else if (flag === '--list-actors') options.listActors = true
    else if (['--actor-id', '--data-file'].includes(flag)) {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error(`Valeur manquante : ${flag}.`)
      if (flag === '--actor-id') options.actorId = value
      else options.dataFile = value
    } else throw new Error(`Option inconnue : ${flag}.`)
  }
  if (options.apply && options.validateOnly)
    throw new Error('--apply et --validate-only sont incompatibles.')
  if (options.listActors && (options.apply || options.validateOnly))
    throw new Error('--list-actors est incompatible avec --apply et --validate-only.')
  return options
}

export async function main(args = process.argv.slice(2)) {
  const options = await atStage('options', async () => readOptions(args))
  const doc = await atStage('document', async () =>
    validateDocument(
      JSON.parse(
        await readFile(options.dataFile ? resolve(options.dataFile) : DEFAULT_DATA, 'utf8'),
      ),
    ),
  )
  if (options.validateOnly) {
    console.log(
      `Document validé : ${doc.entries.length} entrées, réseau ${doc.networkCity}, consultation ${doc.verifiedAt}. Aucune connexion ni écriture.`,
    )
    return
  }
  const databaseUrl = await atStage('environment', async () => {
    if (!process.env.DATABASE_URL) throw new Error()
    return process.env.DATABASE_URL
  })
  const sql = await atStage('connection', async () => neon(databaseUrl))
  const ludoId = await atStage('tenant', async () => {
    const tenant =
      await sql`select l.id, coalesce(p.enabled, false) as enabled from ludotheques l left join public_site_settings p on p.ludo_id=l.id where l.slug=${TENANT}`
    if (tenant.length !== 1 || tenant[0].enabled !== true) throw new Error()
    return tenant[0].id as string
  })
  const members = await atStage(
    'actors',
    () =>
      sql`select id, name, role, is_active from members where ludo_id=${ludoId} and role='responsable' and is_active=true`,
  )
  if (options.listActors) {
    console.log(`Responsables actifs du seul espace ${TENANT}. Lecture seule, aucune écriture.`)
    console.table((members as Member[]).map(({ id, name }) => ({ id, name })))
    return
  }
  const actor = await atStage('actor', async () =>
    chooseActor(members as Member[], options.actorId),
  )
  const existing = await atStage(
    'directory',
    () => sql`select slug, sort_order from public_directory_entries where ludo_id=${ludoId}`,
  )
  const planned = await atStage('plan', async () => planMissing(doc, existing as Existing[]))
  console.log(
    `${options.apply ? 'APPLICATION' : 'SIMULATION'} : espace ${TENANT}, responsable ${actor.name}, ${planned.length} entrées manquantes; ${(existing as Existing[]).length} entrées existantes préservées.`,
  )
  console.table(planned.map(({ slug, name, city, sortOrder }) => ({ slug, name, city, sortOrder })))
  if (!options.apply || !planned.length) return
  const payload = JSON.stringify(
    planned.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      address: entry.address,
      postal_code: entry.postalCode,
      city: entry.city,
      phone: entry.phone,
      email: entry.email,
      website: entry.website,
      directions_url: entry.directionsUrl,
      official_url: entry.officialUrl,
      sort_order: entry.sortOrder,
    })),
  )
  // Une seule requête atomique : les conflits conservent le contenu déjà saisi par l’équipe.
  // L’acteur, le tenant et le module sont revérifiés au moment de l’écriture.
  const result = await atStage(
    'apply',
    () => sql`
    with authorized as (
      select l.id as ludo_id, m.id as actor_id from ludotheques l
      join public_site_settings p on p.ludo_id=l.id and p.enabled=true
      join members m on m.ludo_id=l.id and m.id=${actor.id} and m.role='responsable' and m.is_active=true
      where l.id=${ludoId} and l.slug=${TENANT}
    ), inserted as (
      insert into public_directory_entries
        (ludo_id, slug, name, address, postal_code, city, phone, email, website, directions_url, official_url,
         sort_order, status, revision, author_member_id, updated_by_member_id, published_by_member_id, published_at)
      select a.ludo_id, i.slug, i.name, i.address, i.postal_code, i.city, i.phone, i.email, i.website,
             i.directions_url, i.official_url, i.sort_order, 'published', 1, a.actor_id, a.actor_id, a.actor_id, now()
      from authorized a cross join jsonb_to_recordset(${payload}::jsonb)
        as i(slug text, name text, address text, postal_code text, city text, phone text, email text, website text,
             directions_url text, official_url text, sort_order integer)
      where true
      on conflict (ludo_id, slug) do nothing returning id, ludo_id, slug
    ), audited as (
      insert into activity_log (ludo_id, member_id, action, entity_type, entity_id, metadata)
      select i.ludo_id, ${actor.id}::uuid, e.action, 'public_directory_entry', i.id,
             jsonb_build_object('slug', i.slug, 'import', 'geneva-directory', 'verifiedAt', ${doc.verifiedAt}::text,
                                'sources', ${JSON.stringify(doc.sources)}::jsonb, 'status', 'published')
      from inserted i cross join (values ('public_directory.created'), ('public_directory.published')) as e(action)
      returning id
    )
    select (select count(*)::integer from inserted) as created,
           (select count(*)::integer from audited) as audit_events,
           (select count(*)::integer from authorized) as authorized
  `,
  )
  await atStage('authorization', async () => {
    if (result[0]?.authorized !== 1) throw new Error()
  })
  console.log(
    `${result[0].created} entrées publiées et ${result[0].audit_events} événements d’audit. Les conflits éventuels ont été préservés.`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Le pilote peut inclure les paramètres et l’URL dans une erreur : ne jamais les journaliser.
  main().catch((cause: unknown) => {
    console.error(safeImportDiagnostic(cause))
    process.exitCode = 1
  })
}
