import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '$env/dynamic/private'
import * as schema from '../schema.js'

const createDatabase = () => {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  const sql = neon(env.DATABASE_URL)
  return drizzle(sql, { schema })
}

export type Database = ReturnType<typeof createDatabase>

let database: Database | undefined

/** Initialise le client Neon HTTP au premier usage, jamais au simple import. */
export const getDb = (): Database => {
  database ??= createDatabase()
  return database
}

/** Conserve l'API `db.*` existante tout en différant l'initialisation. */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDb()
    return Reflect.get(instance, property, instance)
  },
})
