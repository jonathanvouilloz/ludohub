/**
 * Import ponctuel des adhérents Paquis-Sécheron dans newsletter_contacts.
 *
 * Source : export "Liste simple adhérents actifs" (rapport paginé, format sale :
 * en-têtes répétés, noms/emails coupés sur plusieurs lignes). Le parser ci-dessous
 * reconstruit les enregistrements et n'extrait QUE les lignes porteuses d'un email
 * (= un contact par famille, le parent payeur — les enfants n'ont pas d'email).
 *
 * Filtrage : on garde les familles (public + emails perso même sur domaine pro),
 * on exclut les comptes de test, le staff FASE et les institutions GE (écoles, ville).
 *
 * Modes :
 *   (défaut)  dry-run  -> aucun write, rapport complet
 *   --commit           -> insert réel (idempotent : dédup sur (ludoId, lower(email)))
 *
 * Autonome : tourne sous tsx, hors runtime SvelteKit (pas de `$env`).
 * Lancer : pnpm tsx scripts/import-newsletter-paquis.ts [--commit]
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../src/lib/server/schema.js'

const { ludotheques, newsletterContacts } = schema

const CSV_PATH = 'C:/Users/jojo-/Downloads/Liste_simple_adherents_actifs.csv'
const TARGET_SLUG = 'paquis-secheron'
const COMMIT = process.argv.includes('--commit')

const EMAIL_FULL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i
const BARCODE = /\b(9199\d{10})\b/

type Rec = { name: string; email: string; barcode: string }

function isSkip(t: string): boolean {
  if (t === '') return true
  if (/^Nom Pr[eé]nom/i.test(t)) return true
  if (/^\d+\s+sur\s+\d+$/.test(t)) return true
  if (/^Liste d['’]adh[eé]rents$/i.test(t)) return true
  if (/^Le\s+\d+/.test(t)) return true
  if (/^Total des adh/i.test(t)) return true
  return false
}

function segments(s: string): string[] {
  return s
    .trim()
    .split(/\s{2,}/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function parse(): Rec[] {
  const raw = readFileSync(CSV_PATH, 'utf8')
  const lines = raw.split(/\r?\n/).map((l) => {
    let s = l
    if (s.startsWith('"')) s = s.slice(1)
    if (s.endsWith('"')) s = s.slice(0, -1)
    return s.replace(/""/g, '"')
  })

  const records: Rec[] = []
  let cur: Rec | null = null

  const isEmailTail = (seg: string) =>
    !seg.includes('@') &&
    !seg.includes(' ') &&
    /^\.?[a-z]+(\.[a-z]+)*$/.test(seg) &&
    (seg.includes('.') || seg.length <= 4)

  for (const rawLine of lines) {
    const s = rawLine.replace(/\s+$/, '')
    const t = s.trim()
    if (isSkip(t)) continue

    const m = s.match(BARCODE)
    if (m && m.index !== undefined) {
      const name = s.slice(0, m.index).trim()
      const rest = s.slice(m.index + m[1].length)
      // email = last column. Either a real token with @, or (if the address wrapped
      // BEFORE the @) a trailing local-part fragment (lowercase, with . or -).
      let email = ''
      const em = rest.match(/(\S+@\S*)\s*$/)
      if (em) {
        email = em[1]
      } else {
        const lastTok = (rest.trim().match(/(\S+)\s*$/) || [])[1] || ''
        if (
          /[a-z]/.test(lastTok) &&
          /^[a-z0-9.+_%-]+$/i.test(lastTok) &&
          (lastTok.includes('.') || lastTok.includes('-')) &&
          !lastTok.includes('/')
        ) {
          email = lastTok // partial local-part, completed on a continuation line
        }
      }
      cur = { name, email, barcode: m[1] }
      records.push(cur)
      continue
    }

    if (!cur) continue
    const segs = segments(s)

    if (cur.email === '') {
      if (/\S+@\S+/.test(t)) {
        const em = t.match(/(\S+@\S*)\s*$/)
        if (em) cur.email = em[1]
        const lead = t.replace(/\S+@\S*\s*$/, '').trim()
        if (lead) cur.name += ' ' + lead
      } else {
        cur.name += ' ' + t
      }
    } else {
      const last = segs[segs.length - 1]
      let nameSegs = segs
      // complete the email either with a lowercase tail ("om", "mail.com", ".com")
      // or, when the wrap happened before the @, with the "@domain" token ("d@gmail.com")
      const completesAt = !cur.email.includes('@') && /@/.test(last) && !last.includes(' ')
      if (last && (isEmailTail(last) || completesAt)) {
        cur.email += last
        nameSegs = segs.slice(0, -1)
      }
      const lead = nameSegs.join(' ').trim()
      if (lead) cur.name += ' ' + lead
    }
  }

  for (const r of records) {
    r.name = r.name.replace(/\s+/g, ' ').trim()
    r.email = r.email.trim()
  }
  return records
}

function category(email: string): string {
  const d = email.split('@')[1]?.toLowerCase() || ''
  if (/test\.ch$/.test(d)) return 'TEST'
  if (/fase\.ch$/.test(d)) return 'FASE-staff'
  if (/(edu\.ge\.ch|ville-ge\.ch|ipe-ge\.ch)$/.test(d)) return 'institution-GE'
  return 'public' // gmail, hotmail, theglobalfund.org, evk.hu, etc. = familles
}

// Institutions GE sont désormais importées (taguées 'institution'). Restent exclus : test + staff FASE.
const EXCLUDED_CATS = new Set(['TEST', 'FASE-staff'])
const tagFor = (email: string): 'famille' | 'institution' =>
  category(email) === 'institution-GE' ? 'institution' : 'famille'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL manquant (.env)')

  const records = parse()
  const withEmail = records.filter((r) => r.email && EMAIL_FULL.test(r.email))

  // dédup intra-fichier (lower email), garde le 1er
  const byEmail = new Map<string, Rec>()
  for (const r of withEmail) {
    const key = r.email.toLowerCase()
    if (!byEmail.has(key)) byEmail.set(key, r)
  }
  let unique = [...byEmail.values()]

  // correction coquille connue
  const typoFixes: { from: string; to: string; name: string }[] = []
  unique = unique.map((r) => {
    if (/@geail\.com$/i.test(r.email)) {
      const fixed = r.email.replace(/@geail\.com$/i, '@gmail.com')
      typoFixes.push({ from: r.email, to: fixed, name: r.name })
      return { ...r, email: fixed }
    }
    return r
  })

  const toImport = unique.filter((r) => !EXCLUDED_CATS.has(category(r.email)))
  const excluded = unique.filter((r) => EXCLUDED_CATS.has(category(r.email)))
  const familles = toImport.filter((r) => tagFor(r.email) === 'famille')
  const institutions = toImport.filter((r) => tagFor(r.email) === 'institution')

  // Artefacts de revue (toujours écrits, même en dry-run)
  const csvEsc = (v: string) => `"${v.replace(/"/g, '""')}"`
  writeFileSync(
    'C:/Users/jojo-/Downloads/newsletter_paquis_familles.csv',
    'email,prenom,nom\n' +
      familles.map((r) => [r.email, '', r.name].map(csvEsc).join(',')).join('\n') +
      '\n',
    'utf8',
  )
  writeFileSync(
    'C:/Users/jojo-/Downloads/newsletter_paquis_institutions.csv',
    'email,nom,categorie\n' +
      institutions
        .map((r) => [r.email, r.name, 'institution-GE'].map(csvEsc).join(','))
        .join('\n') +
      '\n',
    'utf8',
  )

  const sql = neon(databaseUrl)
  const db = drizzle(sql, { schema })

  const ludo = await db.query.ludotheques.findFirst({ where: eq(ludotheques.slug, TARGET_SLUG) })
  if (!ludo) throw new Error(`Ludo "${TARGET_SLUG}" introuvable`)

  const existing = await db.query.newsletterContacts.findMany({
    where: eq(newsletterContacts.ludoId, ludo.id),
    columns: { email: true },
  })
  const existingSet = new Set(existing.map((c) => c.email.toLowerCase()))

  const toInsert = toImport.filter((r) => !existingSet.has(r.email.toLowerCase()))
  const alreadyThere = toImport.filter((r) => existingSet.has(r.email.toLowerCase()))

  console.log('========================================')
  console.log(`MODE        : ${COMMIT ? 'COMMIT (écriture réelle)' : 'DRY-RUN (aucun write)'}`)
  console.log(`Ludo cible  : ${ludo.name} (${ludo.slug}) — id ${ludo.id}`)
  console.log('----------------------------------------')
  console.log(`Lignes-adhérents             : ${records.length}`)
  console.log(`Avec email valide (uniques)  : ${unique.length}`)
  console.log(`  -> familles (tag=famille)  : ${familles.length}`)
  console.log(`  -> institutions (tag=inst.): ${institutions.length}`)
  console.log(`  -> exclus (test/staff)     : ${excluded.length}`)
  console.log(`Déjà en base (skip dédup)    : ${alreadyThere.length}`)
  console.log(`À INSÉRER                    : ${toInsert.length}`)
  console.log('----------------------------------------')
  if (typoFixes.length) {
    console.log('Coquilles corrigées :')
    for (const f of typoFixes) console.log(`  ${f.from} -> ${f.to}  (${f.name})`)
    console.log('----------------------------------------')
  }
  console.log('Exclus (NON importés) :')
  for (const r of excluded) console.log(`  [${category(r.email)}] ${r.email}  (${r.name})`)
  console.log('----------------------------------------')

  if (!COMMIT) {
    console.log('Aperçu des 10 premiers à insérer :')
    for (const r of toInsert.slice(0, 10))
      console.log(`  [${tagFor(r.email)}] ${r.email}  | nom="${r.name}"`)
    console.log(
      `\nDry-run terminé. Relancer avec --commit pour écrire ${toInsert.length} contacts.`,
    )
    return
  }

  if (toInsert.length === 0) {
    console.log('Rien à insérer.')
    return
  }

  const rows = toInsert.map((r) => ({
    ludoId: ludo.id,
    email: r.email,
    firstName: null,
    lastName: r.name,
    tag: tagFor(r.email),
    status: 'subscribed' as const,
    unsubscribeToken: randomUUID(),
    source: 'import' as const,
    notes: `${r.name} · code-barres ${r.barcode}`,
  }))

  // insert par paquets de 50
  let inserted = 0
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    await db.insert(newsletterContacts).values(batch)
    inserted += batch.length
    console.log(`  inséré ${inserted}/${rows.length}`)
  }
  console.log(`\n✅ ${inserted} contacts importés dans ${ludo.slug}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
