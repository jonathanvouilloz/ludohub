import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/index.js'
import { user, session, account, verification } from './schema.js'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  session: {
    // 30 jours
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: [process.env.PUBLIC_APP_URL ?? 'http://localhost:5173'],
  // Le flow d'auth custom (ludo password → member selection) est implémenté
  // dans la feature 02-AUTH via des routes SvelteKit dédiées.
  // Better Auth gère uniquement la persistance des sessions ici.
})
