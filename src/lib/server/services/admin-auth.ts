import type { Cookies } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { makeSignature, constantTimeEqual } from 'better-auth/crypto'

export const ADMIN_COOKIE = 'ludohub_admin'

/** 7 jours, en secondes (session admin volontairement plus courte que la session ludo). */
const ADMIN_MAX_AGE = 60 * 60 * 24 * 7

export type AdminSession = { admin: true }

function secret(): string {
  const s = env.BETTER_AUTH_SECRET
  if (!s) throw new Error('BETTER_AUTH_SECRET manquant')
  return s
}

function superAdminPassword(): string {
  const p = env.SUPER_ADMIN_PASSWORD
  if (!p) throw new Error('SUPER_ADMIN_PASSWORD manquant')
  return p
}

/** Vérifie le mot de passe super-admin (comparaison à temps constant). */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const expected = superAdminPassword()
  // makeSignature égalise les longueurs et constantTimeEqual évite le timing leak.
  const a = await makeSignature(password, secret())
  const b = await makeSignature(expected, secret())
  return constantTimeEqual(a, b)
}

/** Encode + signe le payload de session admin (base64url(json).signature). */
async function sign(payload: AdminSession): Promise<string> {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = await makeSignature(value, secret())
  return `${value}.${sig}`
}

/** Lit + vérifie la signature du cookie de session admin. */
export async function readAdminSession(cookies: Cookies): Promise<AdminSession | null> {
  const raw = cookies.get(ADMIN_COOKIE)
  if (!raw) return null

  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null

  const value = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)

  const expected = await makeSignature(value, secret())
  if (!constantTimeEqual(sig, expected)) return null

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf-8'))
    return parsed?.admin === true ? { admin: true } : null
  } catch {
    return null
  }
}

/** Pose le cookie de session admin signé (httpOnly, 7 jours). */
export async function setAdminSessionCookie(cookies: Cookies): Promise<void> {
  cookies.set(ADMIN_COOKIE, await sign({ admin: true }), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ADMIN_MAX_AGE,
  })
}

/** Supprime le cookie de session admin (logout). */
export function clearAdminSession(cookies: Cookies): void {
  cookies.delete(ADMIN_COOKIE, { path: '/' })
}
