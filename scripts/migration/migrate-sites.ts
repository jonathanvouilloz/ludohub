/**
 * Backfill additif des lieux et de attendance_records.site_id.
 *
 * Dry-run par défaut : `pnpm db:migrate-sites`
 * Écriture explicite : `pnpm db:migrate-sites -- --commit`
 *
 * La migration SQL Drizzle doit être appliquée avant ce script. Le champ texte
 * attendance_records.site est volontairement conservé pour le dual-read/write.
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../../src/lib/server/schema.js'

const COMMIT = process.argv.includes('--commit')

type PlannedSite = typeof schema.ludoSites.$inferInsert & { id: string }

function addressParts(address: string | null): {
  address: string | null
  postalCode: string | null
  city: string | null
} {
  if (!address) return { address: null, postalCode: null, city: null }
  const match = address.match(/^(.*?),?\s+(\d{4})\s+(.+)$/)
  return match
    ? { address: match[1], postalCode: match[2], city: match[3] }
    : { address, postalCode: null, city: null }
}

function desiredSites(ludo: typeof schema.ludotheques.$inferSelect): PlannedSite[] {
  if (ludo.slug === 'paquis-secheron') {
    return [
      {
        id: randomUUID(),
        ludoId: ludo.id,
        slug: 'paquis',
        name: 'Pâquis',
        address: 'Rue de Berne 50',
        postalCode: '1201',
        city: 'Genève',
        phone: '+41 22 731 20 09',
        email: ludo.email,
        isPrimary: true,
        sortOrder: 0,
      },
      {
        id: randomUUID(),
        ludoId: ludo.id,
        slug: 'secheron',
        name: 'Sécheron',
        address: 'Anne-Torcapel 2',
        postalCode: '1202',
        city: 'Genève',
        phone: '+41 22 731 94 65',
        email: ludo.email,
        isPrimary: false,
        sortOrder: 1,
      },
    ]
  }
  const parts = addressParts(ludo.address)
  return [
    {
      id: randomUUID(),
      ludoId: ludo.id,
      slug: ludo.slug,
      name: ludo.name,
      ...parts,
      phone: ludo.phone,
      email: ludo.email,
      isPrimary: true,
      sortOrder: 0,
    },
  ]
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (.env)')
  const client = neon(process.env.DATABASE_URL)
  const db = drizzle(client, { schema })

  const [ludos, existingSites, attendance] = await Promise.all([
    db.query.ludotheques.findMany(),
    db.query.ludoSites.findMany(),
    db.query.attendanceRecords.findMany({
      columns: { id: true, ludoId: true, site: true, siteId: true },
    }),
  ])
  const structuralAnomalies: string[] = []
  const attendanceAnomalies: string[] = []
  if (ludos.length === 0) structuralAnomalies.push('aucun espace LudoHub trouvé')
  const plannedSites: PlannedSite[] = []
  const sitesByLudo = new Map<string, PlannedSite[]>()

  for (const ludo of ludos) {
    const current = existingSites.filter((site) => site.ludoId === ludo.id)
    const desired = desiredSites(ludo)
    let nextSortOrder = current.reduce((max, site) => Math.max(max, site.sortOrder), -1) + 1
    for (const candidate of desired) {
      if (
        (current.length === 0 || ludo.slug === 'paquis-secheron') &&
        !current.some((site) => site.slug === candidate.slug)
      ) {
        plannedSites.push({
          ...candidate,
          sortOrder: current.length === 0 ? candidate.sortOrder : nextSortOrder++,
        })
      }
    }
    const finalSites = [...current, ...plannedSites.filter((site) => site.ludoId === ludo.id)]
    const activePrimaries = finalSites.filter((site) => site.isActive !== false && site.isPrimary)
    if (activePrimaries.length !== 1) {
      structuralAnomalies.push(
        `${ludo.slug}: ${activePrimaries.length} lieu(x) principal(aux) actif(s), attendu 1`,
      )
    }
    if (finalSites.some((site) => site.isPrimary && site.isActive === false)) {
      structuralAnomalies.push(`${ludo.slug}: un lieu principal est inactif`)
    }
    const sortOrders = finalSites.map((site) => site.sortOrder)
    if (new Set(sortOrders).size !== sortOrders.length) {
      structuralAnomalies.push(`${ludo.slug}: ordres d'affichage dupliqués`)
    }
    if (finalSites.some((site) => (site.latitude == null) !== (site.longitude == null))) {
      structuralAnomalies.push(`${ludo.slug}: coordonnées géographiques incomplètes`)
    }
    sitesByLudo.set(ludo.id, finalSites as PlannedSite[])
  }

  const backfills: Array<{ recordId: string; ludoId: string; siteId: string }> = []
  for (const record of attendance) {
    if (record.siteId) continue
    const sites = sitesByLudo.get(record.ludoId) ?? []
    const target = record.site
      ? sites.find((site) => site.slug === record.site)
      : sites.length === 1
        ? sites[0]
        : undefined
    if (target) backfills.push({ recordId: record.id, ludoId: record.ludoId, siteId: target.id })
    else {
      attendanceAnomalies.push(
        `attendance ${record.id}: site legacy « ${record.site ?? 'null'} » non résolu`,
      )
    }
  }

  console.log(`Mode : ${COMMIT ? 'COMMIT' : 'DRY-RUN (aucune écriture)'}`)
  console.log('\nAvant :')
  console.log(`  espaces                  ${ludos.length}`)
  console.log(`  lieux                    ${existingSites.length}`)
  console.log(`  fréquentations           ${attendance.length}`)
  console.log(`  fréquentations sans UUID ${attendance.filter((row) => !row.siteId).length}`)
  console.log('\nPlan :')
  console.log(`  lieux à ajouter          ${plannedSites.length}`)
  console.log(`  site_id à renseigner     ${backfills.length}`)
  console.log(`  anomalies structurelles ${structuralAnomalies.length}`)
  for (const anomaly of structuralAnomalies) console.log(`  - BLOQUANT: ${anomaly}`)
  console.log(`  anomalies fréquentation ${attendanceAnomalies.length}`)
  for (const anomaly of attendanceAnomalies) console.log(`  - TOLÉRÉ: ${anomaly}`)

  if (COMMIT && structuralAnomalies.length > 0) {
    throw new Error(
      `Commit refusé: ${structuralAnomalies.length} anomalie(s) structurelle(s) à corriger.`,
    )
  }

  if (COMMIT) {
    if (plannedSites.length) await db.insert(schema.ludoSites).values(plannedSites)
    for (const item of backfills) {
      await db
        .update(schema.attendanceRecords)
        .set({ siteId: item.siteId, updatedAt: new Date() })
        .where(
          and(
            eq(schema.attendanceRecords.id, item.recordId),
            eq(schema.attendanceRecords.ludoId, item.ludoId),
          ),
        )
    }
  }

  console.log('\nAprès' + (COMMIT ? ' :' : ' (projection) :'))
  console.log(`  lieux                    ${existingSites.length + plannedSites.length}`)
  console.log(
    `  fréquentations sans UUID ${attendance.filter((row) => !row.siteId).length - backfills.length}`,
  )
  console.log(
    COMMIT ? '\n✓ Migration appliquée.' : '\nDry-run terminé. Relancer avec --commit pour écrire.',
  )
}

main().catch((error) => {
  console.error('✗ Migration des lieux échouée :', error)
  process.exitCode = 1
})
