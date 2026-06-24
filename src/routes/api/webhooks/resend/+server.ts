import { createHmac, timingSafeEqual } from 'node:crypto'
import { json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { markBouncedByEmail, markCampaignSendBouncedByResendId } from '$lib/server/db/newsletter.js'
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

/** Id Resend de l'email concerné (`email_id`), pour relier le bounce à un envoi. */
function extractResendId(data: unknown): string | null {
  const d = (data ?? {}) as { email_id?: unknown }
  return typeof d.email_id === 'string' ? d.email_id : null
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

  // Anti-rejeu : le timestamp Svix (secondes Unix) entre dans le HMAC mais reste
  // valable indéfiniment tant qu'on ne le borne pas. On rejette hors fenêtre ±5 min
  // pour empêcher de rejouer une requête signée capturée.
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) {
    return json({ error: 'Timestamp outside tolerance' }, { status: 401 })
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
    // Relie aussi le rejet à l'envoi précis (si l'id Resend est présent) pour les
    // statistiques par campagne.
    const resendId = extractResendId(payload.data)
    if (resendId) await markCampaignSendBouncedByResendId(resendId)
  }

  return json({ ok: true })
}
