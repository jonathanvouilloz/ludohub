import { Resend } from 'resend'
import { env } from '$env/dynamic/private'

/** Erreur de configuration ou d'envoi email (message destiné à l'UI responsable). */
export class ResendError extends Error {}

let client: Resend | null = null

/**
 * Client Resend partagé. La clé est lue paresseusement via `$env/dynamic/private`
 * (jamais `process.env`) pour rester compatible build SvelteKit + Vercel.
 */
export function getResend(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new ResendError("L'envoi d'emails n'est pas configuré (RESEND_API_KEY manquant).")
  }
  if (!client) client = new Resend(env.RESEND_API_KEY)
  return client
}

/** Adresse d'expédition vérifiée (domaine LudoHub partagé). */
export function newsletterFrom(): string {
  const from = env.NEWSLETTER_FROM
  if (!from) {
    throw new ResendError("L'adresse d'expédition n'est pas configurée (NEWSLETTER_FROM manquant).")
  }
  return from
}
