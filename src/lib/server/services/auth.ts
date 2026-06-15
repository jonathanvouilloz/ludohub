import type { Cookies } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { hashPassword, verifyPassword, makeSignature, constantTimeEqual } from 'better-auth/crypto'
import { getLudoBySlug } from '../db/ludotheques.js'
import { getActiveMembersByLudo } from '../db/members.js'
import type { LudothequeRow, MemberRow } from '../schema.js'

export const SESSION_COOKIE = 'ludohub_session'

/** 30 jours, en secondes. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export type LudoSession = { ludoId: string; memberId: string }

function secret(): string {
  const s = env.BETTER_AUTH_SECRET
  if (!s) throw new Error('BETTER_AUTH_SECRET manquant')
  return s
}

/**
 * Hache un mot de passe de ludo (scrypt via Better Auth). Utilisé par le seed
 * et la future création de ludo.
 */
export function hashLudoPassword(password: string): Promise<string> {
  return hashPassword(password)
}

/**
 * Vérifie le mot de passe partagé d'une ludo identifiée par son slug.
 * Retourne la ludo + ses membres actifs si OK, sinon `null` (message générique côté UI).
 */
export async function verifyLudoPassword(
  slug: string,
  password: string,
): Promise<{ ludo: LudothequeRow; members: MemberRow[] } | null> {
  const ludo = await getLudoBySlug(slug)
  if (!ludo) return null

  const ok = await verifyPassword({ hash: ludo.passwordHash, password })
  if (!ok) return null

  const members = await getActiveMembersByLudo(ludo.id)
  return { ludo, members }
}

/** Encode + signe le payload de session (base64url(json).signature). */
async function sign(payload: LudoSession): Promise<string> {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = await makeSignature(value, secret())
  return `${value}.${sig}`
}

/** Lit + vérifie la signature du cookie de session. */
export async function readLudoSession(cookies: Cookies): Promise<LudoSession | null> {
  const raw = cookies.get(SESSION_COOKIE)
  if (!raw) return null

  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null

  const value = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)

  const expected = await makeSignature(value, secret())
  if (!constantTimeEqual(sig, expected)) return null

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf-8'))
    if (typeof parsed?.ludoId === 'string' && typeof parsed?.memberId === 'string') {
      return { ludoId: parsed.ludoId, memberId: parsed.memberId }
    }
    return null
  } catch {
    return null
  }
}

/** Pose le cookie de session signé (httpOnly, 30 jours). */
export async function setLudoSessionCookie(cookies: Cookies, payload: LudoSession): Promise<void> {
  // `secure` est laissé à SvelteKit : true en https, toléré sur http://localhost en dev.
  cookies.set(SESSION_COOKIE, await sign(payload), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
  })
}

/** Supprime le cookie de session (logout). */
export function clearLudoSession(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' })
}
