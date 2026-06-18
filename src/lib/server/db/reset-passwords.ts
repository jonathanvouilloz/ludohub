/**
 * Script one-shot : reset le mot de passe de toutes les ludothèques à "admin".
 * Usage : pnpm tsx src/lib/server/db/reset-passwords.ts
 */
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { hashPassword } from 'better-auth/crypto'
import { ludotheques } from '../schema.js'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema: { ludotheques } })

const hash = await hashPassword('admin')
const result = await db.update(ludotheques).set({ passwordHash: hash }).returning({ slug: ludotheques.slug })

console.log(`✓ ${result.length} ludo(s) mises à jour → mdp "admin"`)
result.forEach((r) => console.log(`  - ${r.slug}`))
