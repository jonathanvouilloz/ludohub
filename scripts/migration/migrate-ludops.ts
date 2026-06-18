/**
 * Phase B de la migration samediLudoV2 -> LudoHub.
 *
 * Charge `ludops-export.json` (produit par extract-ludops.py) dans Neon, en
 * reformatant chaque table vers le schema multi-tenant. Tout est importe dans
 * UNE ludo cible `paquis-secheron` (Paquis + Secheron, meme equipe).
 *
 * Modes :
 *   (defaut)    dry-run  -> aucun write, produit un rapport (comptes, pertes, ignores)
 *   --commit             -> execute reellement (idempotent : purge la ludo cible puis re-insere)
 *
 * Autonome : tourne sous tsx, hors runtime SvelteKit (pas de `$env`).
 * Lancer : pnpm db:migrate-ludops [--commit]
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq, inArray } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { hashPassword } from 'better-auth/crypto'
import * as schema from '../../src/lib/server/schema.js'

const {
  ludotheques,
  members,
  seasons,
  saturdaySlots,
  assignments,
  themes,
  themeItems,
  themeInstallations,
  themeInstallationItems,
  themeCheckups,
  themeCheckupItems,
  gameWishes,
  supplyRequests,
  activityLog,
} = schema

// ─── Cible ─────────────────────────────────────────────────────────────────
const TARGET_SLUG = 'paquis-secheron'
const TARGET = {
  name: 'Ludothèque des Pâquis-Sécheron',
  slug: TARGET_SLUG,
  color: '#1D3557',
  address: 'Rue de Berne 50, 1201 Genève',
  phone: '+41 22 731 20 09',
  email: 'lu.paquissecheron@fase.ch',
  responsible: 'Alessia Ditta',
  password: 'paquis-secheron2026',
}
// Ludos demo du seed remplacees par la ludo fusionnee.
const DEMO_SLUGS_TO_DROP = ['paquis', 'secheron']

const COMMIT = process.argv.includes('--commit')

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXPORT_PATH = join(__dirname, 'ludops-export.json')

type Row = Record<string, any>
type Export = Record<string, Row[]>

const losses: string[] = []
const ignored: string[] = []

// ─── Helpers de transformation ───────────────────────────────────────────────

/** SQLite stocke 'YYYY-MM-DD HH:MM:SS' ou ISO. -> Date (ou undefined si null). */
function toDate(v: string | null | undefined): Date | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function memberRole(label: string | null): 'member' | 'responsable' {
  return label && label.toLowerCase().includes('responsable') ? 'responsable' : 'member'
}

function supplyUrgency(u: string): 'normale' | 'haute' | 'critique' {
  if (u === 'haute' || u === 'critique') return u
  if (u === 'normale' || u === 'normal') return 'normale'
  return 'normale'
}

function checkupItemStatus(s: string): 'present' | 'manquant' {
  return s === 'present' ? 'present' : 'manquant' // 'broken'/'missing'/... -> manquant
}

/** Derive entity_type a partir du prefixe du type d'evenement legacy. */
function entityTypeForAction(action: string): string {
  const map: [RegExp, string][] = [
    [/^game_/, 'game'],
    [/^theme_item/, 'theme_item'],
    [/^theme_/, 'theme'],
    [/^slot_/, 'slot'],
    [/^event_/, 'slot'],
    [/^absence_/, 'absence'],
    [/^supply_/, 'supply'],
    [/^checkup_/, 'checkup'],
    [/^period_/, 'installation'],
    [/^proposal_/, 'help'],
    [/^school_/, 'school'],
    [/^swap/, 'assignment'],
  ]
  for (const [re, t] of map) if (re.test(action)) return t
  return 'legacy'
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (.env)')

  const data = JSON.parse(readFileSync(EXPORT_PATH, 'utf-8')) as Export
  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql, { schema })

  console.log('='.repeat(64))
  console.log(`MIGRATION ludops -> LudoHub  [${COMMIT ? 'COMMIT' : 'DRY-RUN'}]`)
  console.log('='.repeat(64))

  // ── Ludo cible : upsert par slug ────────────────────────────────────────
  let ludoId: string
  const existingLudo = await db.query.ludotheques.findFirst({
    where: eq(ludotheques.slug, TARGET_SLUG),
  })

  if (existingLudo) {
    ludoId = existingLudo.id
    console.log(`Ludo cible « ${TARGET_SLUG} » existe (id ${ludoId}).`)
    if (COMMIT) await purgeLudoData(db, ludoId)
    else await reportExistingData(db, ludoId)
  } else {
    ludoId = randomUUID()
    console.log(`Ludo cible « ${TARGET_SLUG} » a creer (id ${ludoId}).`)
    if (COMMIT) {
      const passwordHash = await hashPassword(TARGET.password)
      await db.insert(ludotheques).values({
        id: ludoId,
        name: TARGET.name,
        slug: TARGET.slug,
        passwordHash,
        color: TARGET.color,
        address: TARGET.address,
        phone: TARGET.phone,
        email: TARGET.email,
        responsible: TARGET.responsible,
      })
    }
  }

  // ── Suppression des ludos demo paquis / secheron ─────────────────────────
  const demos = await db.query.ludotheques.findMany({
    where: inArray(ludotheques.slug, DEMO_SLUGS_TO_DROP),
  })
  if (demos.length) {
    console.log(`Ludos demo a supprimer : ${demos.map((d) => d.slug).join(', ')}`)
    if (COMMIT) {
      await db.delete(ludotheques).where(
        inArray(
          ludotheques.id,
          demos.map((d) => d.id),
        ),
      )
    }
  }

  // ── Maps old ULID -> new UUID ────────────────────────────────────────────
  const memberMap = new Map<string, string>()
  const seasonMap = new Map<string, string>()
  const slotMap = new Map<string, string>()
  const themeMap = new Map<string, string>()
  const themeItemMap = new Map<string, string>()
  const installationMap = new Map<string, string>() // old period id -> installation uuid
  const installItemMap = new Map<string, string>() // old theme_item id -> installation_item uuid
  const checkupMap = new Map<string, string>() // old checkup id -> checkup uuid

  // ── MEMBERS ──────────────────────────────────────────────────────────────
  const memberRows = data.members.map((m) => {
    const id = randomUUID()
    memberMap.set(m.id, id)
    if (m.is_permanent || m.label) losses.push(`member ${m.name}: label/is_permanent non migres`)
    return {
      id,
      ludoId,
      name: m.name as string,
      role: memberRole(m.label),
      isActive: !!m.is_active,
      createdAt: toDate(m.created_at),
    }
  })
  const responsableId =
    memberRows.find((m) => m.role === 'responsable')?.id ?? memberRows[0]?.id ?? null

  // ── SEASONS ────────────────────────────────────────────────────────────────
  const seasonDefaultSlots = new Map<string, number>()
  const seasonRows = data.seasons.map((s) => {
    const id = randomUUID()
    seasonMap.set(s.id, id)
    seasonDefaultSlots.set(s.id, s.default_slots ?? 2)
    return {
      id,
      ludoId,
      name: s.name as string,
      startDate: s.start_date as string,
      endDate: s.end_date as string,
      createdAt: toDate(s.created_at),
    }
  })

  // ── SATURDAY SLOTS ──────────────────────────────────────────────────────────
  const slotRows = data.saturday_slots.map((s) => {
    const id = randomUUID()
    slotMap.set(s.id, id)
    if (s.type === 'event' && s.event_label)
      losses.push(`slot ${s.date}: event_label « ${s.event_label} » non migre`)
    const fallback = seasonDefaultSlots.get(s.season_id) ?? 2
    return {
      id,
      seasonId: seasonMap.get(s.season_id)!,
      date: s.date as string,
      type: 'normal' as const,
      requiredCount: (s.required_count ?? fallback) as number,
      isCancelled: !!s.is_closed,
    }
  })

  // ── ASSIGNMENTS ─────────────────────────────────────────────────────────────
  const seenAssign = new Set<string>()
  const assignmentRows: Array<{ id: string; slotId: string; memberId: string }> = []
  for (const a of data.assignments) {
    const slotId = slotMap.get(a.slot_id)
    const memberId = memberMap.get(a.member_id)
    if (!slotId || !memberId) {
      ignored.push(`assignment ${a.id}: slot/membre introuvable`)
      continue
    }
    const key = `${slotId}|${memberId}`
    if (seenAssign.has(key)) {
      ignored.push(`assignment ${a.id}: doublon (slot,membre)`)
      continue
    }
    seenAssign.add(key)
    assignmentRows.push({ id: randomUUID(), slotId, memberId })
  }

  // ── THEMES + ITEMS ──────────────────────────────────────────────────────────
  const themeRows = data.themes.map((t) => {
    const id = randomUUID()
    themeMap.set(t.id, id)
    return {
      id,
      ownerLudoId: ludoId,
      name: t.name as string,
      isShareable: false,
      isArchived: false,
      createdAt: toDate(t.created_at),
    }
  })
  const themeItemRows = data.theme_items.map((it) => {
    const id = randomUUID()
    themeItemMap.set(it.id, id)
    return {
      id,
      themeId: themeMap.get(it.theme_id)!,
      name: it.name as string,
      quantity: (it.quantity ?? 1) as number,
      isArchived: !!it.is_archived,
    }
  })

  // ── CHECK-UPS : periode -> installation ──────────────────────────────────────
  const installationRows = data.theme_periods.map((p) => {
    const id = randomUUID()
    installationMap.set(p.id, id)
    return {
      id,
      themeId: themeMap.get(p.theme_id)!,
      ludoId,
      installedByMemberId: memberMap.get(p.started_by) ?? responsableId!,
      installedAt: toDate(p.created_at) ?? new Date(),
      closedAt: toDate(p.closed_at),
      status: (p.closed_at ? 'cloturee' : 'en_cours') as 'cloturee' | 'en_cours',
      createdAt: toDate(p.created_at),
    }
  })

  // installation_items : theme_items distincts references par les checkup_entries
  // (regroupes par periode via le checkup parent).
  const checkupToPeriod = new Map<string, string>()
  for (const c of data.checkups) checkupToPeriod.set(c.id, c.theme_period_id)
  const installItemRows: Array<{ id: string; installationId: string; themeItemId: string }> = []
  const seenInstallItem = new Set<string>() // periodId|themeItemId
  for (const e of data.checkup_entries) {
    const periodId = checkupToPeriod.get(e.checkup_id)
    const themeItemId = e.theme_item_id ? themeItemMap.get(e.theme_item_id) : undefined
    const installationId = periodId ? installationMap.get(periodId) : undefined
    if (!installationId || !themeItemId) continue
    const key = `${periodId}|${e.theme_item_id}`
    if (seenInstallItem.has(key)) continue
    seenInstallItem.add(key)
    const id = randomUUID()
    installItemMap.set(e.theme_item_id, id)
    installItemRows.push({ id, installationId, themeItemId })
  }

  const checkupRows = data.checkups.map((c) => {
    const id = randomUUID()
    checkupMap.set(c.id, id)
    return {
      id,
      installationId: installationMap.get(c.theme_period_id)!,
      checkedByMemberId: memberMap.get(c.done_by) ?? responsableId!,
      checkedAt: toDate(c.completed_at) ?? toDate(c.created_at) ?? new Date(),
      notes: (c.note ?? null) as string | null,
      createdAt: toDate(c.created_at),
    }
  })

  const checkupItemRows: Array<{
    id: string
    checkupId: string
    installationItemId: string
    status: 'present' | 'manquant'
    note: string | null
  }> = []
  for (const e of data.checkup_entries) {
    const checkupId = checkupMap.get(e.checkup_id)
    const installationItemId = e.theme_item_id ? installItemMap.get(e.theme_item_id) : undefined
    if (!checkupId || !installationItemId) {
      ignored.push(`checkup_entry ${e.id}: checkup/item introuvable`)
      continue
    }
    if (e.suggested_name || e.resolved_at)
      losses.push(`checkup_entry ${e.id}: suggested_name/resolution non migres`)
    checkupItemRows.push({
      id: randomUUID(),
      checkupId,
      installationItemId,
      status: checkupItemStatus(e.status),
      note: (e.note ?? null) as string | null,
    })
  }

  // ── GAME WISHES ─────────────────────────────────────────────────────────────
  const gameWishRows = data.game_wishes.map((g) => {
    if (g.added_by) losses.push(`game ${g.name}: added_by non migre`)
    return {
      id: randomUUID(),
      ludoId,
      title: g.name as string,
      link: (g.link ?? null) as string | null,
      priceChf: g.price != null ? Math.round(Number(g.price) * 100) : null,
      status: (g.is_purchased ? 'achete' : 'souhaite') as 'achete' | 'souhaite',
      buyerId: g.purchased_by ? (memberMap.get(g.purchased_by) ?? null) : null,
      createdAt: toDate(g.created_at),
    }
  })

  // ── SUPPLY REQUESTS ──────────────────────────────────────────────────────────
  const supplyRows = data.supply_needs.map((s) => {
    const memberId = s.added_by ? (memberMap.get(s.added_by) ?? responsableId!) : responsableId!
    const extra: string[] = []
    if (s.link) extra.push(`Lien: ${s.link}`)
    if (s.price != null) extra.push(`Prix: ${s.price}`)
    if (s.link || s.price != null) losses.push(`supply ${s.name}: link/price replies en notes`)
    return {
      id: randomUUID(),
      ludoId,
      memberId,
      name: s.name as string,
      urgency: supplyUrgency(s.urgency),
      status: (s.is_purchased ? 'recu' : 'en_attente') as 'recu' | 'en_attente',
      notes: extra.length ? extra.join(' — ') : null,
      createdAt: toDate(s.created_at),
    }
  })

  // ── ACTIVITY LOG ─────────────────────────────────────────────────────────────
  const activityRows = data.activity_log.map((a) => {
    let parsed: Record<string, any> = {}
    if (a.metadata) {
      try {
        parsed = JSON.parse(a.metadata)
      } catch {
        parsed = { raw: a.metadata }
      }
    }
    return {
      id: randomUUID(),
      ludoId,
      memberId: a.actor_id ? (memberMap.get(a.actor_id) ?? null) : null,
      action: a.type as string,
      entityType: entityTypeForAction(a.type),
      entityId: null,
      metadata: { ...parsed, description: a.description, legacyId: a.id },
      createdAt: toDate(a.created_at),
    }
  })
  losses.push('activity_log: entity_id non remappe (ULID legacy) ; description preservee dans metadata')

  // ── Ecriture (commit) ────────────────────────────────────────────────────────
  if (COMMIT) {
    if (memberRows.length) await db.insert(members).values(memberRows)
    if (seasonRows.length) await db.insert(seasons).values(seasonRows)
    if (slotRows.length) await db.insert(saturdaySlots).values(slotRows)
    if (assignmentRows.length) await db.insert(assignments).values(assignmentRows)
    if (themeRows.length) await db.insert(themes).values(themeRows)
    if (themeItemRows.length) await db.insert(themeItems).values(themeItemRows)
    if (installationRows.length) await db.insert(themeInstallations).values(installationRows)
    if (installItemRows.length) await db.insert(themeInstallationItems).values(installItemRows)
    if (checkupRows.length) await db.insert(themeCheckups).values(checkupRows)
    if (checkupItemRows.length) await db.insert(themeCheckupItems).values(checkupItemRows)
    if (gameWishRows.length) await db.insert(gameWishes).values(gameWishRows)
    if (supplyRows.length) await db.insert(supplyRequests).values(supplyRows)
    if (activityRows.length) await db.insert(activityLog).values(activityRows)
  }

  // ── Rapport ────────────────────────────────────────────────────────────────
  console.log('\nLignes a inserer :')
  const report: [string, number][] = [
    ['members', memberRows.length],
    ['seasons', seasonRows.length],
    ['saturday_slots', slotRows.length],
    ['assignments', assignmentRows.length],
    ['themes', themeRows.length],
    ['theme_items', themeItemRows.length],
    ['theme_installations', installationRows.length],
    ['theme_installation_items', installItemRows.length],
    ['theme_checkups', checkupRows.length],
    ['theme_checkup_items', checkupItemRows.length],
    ['game_wishes', gameWishRows.length],
    ['supply_requests', supplyRows.length],
    ['activity_log', activityRows.length],
  ]
  for (const [t, n] of report) console.log(`  ${t.padEnd(26)} ${String(n).padStart(4)}`)

  if (ignored.length) {
    console.log(`\nLignes ignorees (${ignored.length}) :`)
    for (const i of ignored) console.log(`  - ${i}`)
  } else {
    console.log('\nAucune ligne ignoree.')
  }

  console.log(`\nPertes assumees (${losses.length}) — echantillon :`)
  for (const l of dedupeSample(losses)) console.log(`  - ${l}`)

  console.log(
    `\n${COMMIT ? '✓ COMMIT effectue.' : 'DRY-RUN : aucun write. Relancer avec --commit pour appliquer.'}`,
  )
}

/** Regroupe les pertes repetitives en une ligne + compteur. */
function dedupeSample(items: string[]): string[] {
  const buckets = new Map<string, number>()
  for (const i of items) {
    const key = i.replace(/«[^»]*»/g, '«…»').replace(/[A-Za-z0-9 ]+: /, (m) =>
      /(member|game|slot|supply|checkup_entry)/.test(m) ? m.split(' ')[0] + ' …: ' : m,
    )
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.entries()].map(([k, n]) => (n > 1 ? `${k} (×${n})` : k))
}

/**
 * Purge idempotente des donnees de la ludo cible, dans l'ordre des contraintes
 * FK non-cascade (installations & ludo refs) avant les cascades.
 */
async function purgeLudoData(db: ReturnType<typeof drizzle<typeof schema>>, ludoId: string) {
  console.log('Purge des donnees existantes de la ludo cible…')
  // installations (ludoId non-cascade) -> cascade items/checkups
  const inst = await db.query.themeInstallations.findMany({
    where: eq(themeInstallations.ludoId, ludoId),
    columns: { id: true },
  })
  if (inst.length)
    await db.delete(themeInstallations).where(
      inArray(
        themeInstallations.id,
        inst.map((i) => i.id),
      ),
    )
  // themes (ownerLudoId cascade) -> items/images/loans
  await db.delete(themes).where(eq(themes.ownerLudoId, ludoId))
  // seasons (cascade slots -> assignments)
  await db.delete(seasons).where(eq(seasons.ludoId, ludoId))
  await db.delete(schema.absences).where(eq(schema.absences.ludoId, ludoId))
  await db.delete(gameWishes).where(eq(gameWishes.ludoId, ludoId))
  await db.delete(supplyRequests).where(eq(supplyRequests.ludoId, ludoId))
  await db.delete(activityLog).where(eq(activityLog.ludoId, ludoId))
  await db.delete(schema.notifications).where(eq(schema.notifications.recipientLudoId, ludoId))
  await db.delete(members).where(eq(members.ludoId, ludoId))
}

/** Dry-run : compte ce qui serait supprime. */
async function reportExistingData(db: ReturnType<typeof drizzle<typeof schema>>, ludoId: string) {
  const m = await db.query.members.findMany({ where: eq(members.ludoId, ludoId), columns: { id: true } })
  console.log(`  (dry-run) la ludo contient deja ${m.length} membre(s) — seraient purges avant import.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Migration echouee :', err)
    process.exit(1)
  })
