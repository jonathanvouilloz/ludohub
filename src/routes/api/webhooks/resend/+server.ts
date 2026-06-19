import { createHmac, timingSafeEqual } from 'node:crypto'
import { json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { markBouncedByEmail } from '$lib/server/db/newsletter.js'
import type { RequestHandler } from './$types'

/**
 * Vérifie la signature Svix d'un webhook Resend.
 * Schéma : HMAC-SHA256(`${id}.${timestamp}.${body}`) avec la clé = base64 du
 * secret après le préfixe `whsec_`. L'en-tête `svix-signature` liste une ou
 * plusieurs signatures `v1,<base64>`.
 */
function isValidSignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  header: string,
): boolean {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
  const expectedBuf = Buffer.from(expected)
  return header
    .split(' ')
    .map((part) => part.split(',')[1] ?? part)
    .some((sig) => {
      const sigBuf = Buffer.from(sig)
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
    })
}

function extractEmails(data: unknown): string[] {
  const d = (data ?? {}) as { to?: unknown; email?: unknown }
  if (Array.isArray(d.to)) return d.to.filter((x): x is string => typeof x === 'string')
  if (typeof d.to === 'string') return [d.to]
  if (typeof d.email === 'string') return [d.email]
  return []
}

/** Webhook Resend : bounces & plaintes → passe le contact à `bounced`. */
export const POST: RequestHandler = async (event) => {
  const secret = env.RESEND_WEBHOOK_SECRET
  // Non configuré : on acquitte sans traiter pour éviter les relances Resend.
  if (!secret) return json({ skipped: true })

  const body = await event.request.text()
  const id = event.request.headers.get('svix-id') ?? ''
  const timestamp = event.request.headers.get('svix-timestamp') ?? ''
  const signature = event.request.headers.get('svix-signature') ?? ''

  if (
    !id ||
    !timestamp ||
    !signature ||
    !isValidSignature(secret, id, timestamp, body, signature)
  ) {
    return json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { type?: string; data?: unknown }
  try {
    payload = JSON.parse(body)
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.type === 'email.bounced' || payload.type === 'email.complained') {
    for (const email of extractEmails(payload.data)) {
      await markBouncedByEmail(email)
    }
  }

  return json({ ok: true })
}
