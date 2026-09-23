import { getLudoBySlug } from './db/ludotheques.js'
import { ExtensionAuthError } from './services/extension-auth.js'

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/

/** Slug absent : la ludothèque du poste lié. Slug présent : cette ludothèque, sans exposer son identifiant interne. */
export async function extensionTargetLudoId(slug: string | null, fallbackLudoId: string) {
  if (!slug) return fallbackLudoId
  if (!SLUG.test(slug)) throw new ExtensionAuthError('invalid_request')
  const ludo = await getLudoBySlug(slug)
  if (!ludo) throw new ExtensionAuthError('invalid_request')
  return ludo.id
}
