import { error, redirect, type RequestEvent } from '@sveltejs/kit'
import { getLudoById, getLudoBySlug } from './db/ludotheques.js'
import { getMemberById } from './db/members.js'
import { clearLudoSession, isSessionExpired, passwordVersion } from './services/auth.js'
import type { LudoSession } from './services/auth.js'
import type { LudothequeRow } from './schema.js'
import { belongsToLudo, isActiveMember, isResponsable } from '$lib/utils/permissions.js'

/**
 * Session encore valable pour cette ludo ? Rejette si expirée (iat) ou si le mot
 * de passe de la ludo a changé depuis le login (pv), ce qui révoque toutes les
 * sessions ouvertes après un reset admin.
 */
function isSessionStillValid(session: LudoSession, ludo: LudothequeRow): boolean {
  return !isSessionExpired(session) && session.pv === passwordVersion(ludo.passwordHash)
}

type Ctx = Pick<RequestEvent, 'params' | 'locals' | 'cookies'>

/**
 * Résout `ludo` + `member` pour une requête sous `[ludo]`, depuis `params.ludo`
 * et la session (cookie). À utiliser dans les form actions : `locals.ludo` /
 * `locals.currentMember` ne sont posés que par le `load` du layout, lequel ne
 * s'exécute PAS avant une action en SvelteKit (les loads tournent après).
 */
export async function requireLudoContext(event: Ctx) {
  const slug = event.params.ludo as string
  const ludo = await getLudoBySlug(slug)
  if (!ludo) throw error(404, 'Ludothèque introuvable')

  const session = event.locals.ludoSession
  if (!session || session.ludoId !== ludo.id || !isSessionStillValid(session, ludo)) {
    clearLudoSession(event.cookies)
    throw redirect(303, `/auth/${slug}`)
  }

  const member = await getMemberById(session.memberId)
  if (!member || !isActiveMember(member) || !belongsToLudo(member, ludo.id)) {
    clearLudoSession(event.cookies)
    throw redirect(303, `/auth/${slug}`)
  }

  return { ludo, member }
}

/** Variante exigeant le rôle responsable (sinon 403). */
export async function requireResponsableContext(event: Ctx) {
  const ctx = await requireLudoContext(event)
  if (!isResponsable(ctx.member)) {
    throw error(403, 'Accès refusé')
  }
  return ctx
}

/**
 * Résout `ludo` + `member` à partir de la seule session (cookie), sans param
 * `[ludo]` dans l'URL. Pour les routes cross-ludo `/reseau/*` et l'endpoint
 * d'upload, qui n'ont pas de slug. Renvoie vers `/` si pas de session valide.
 */
export async function requireSessionContext(event: Pick<RequestEvent, 'locals' | 'cookies'>) {
  const session = event.locals.ludoSession
  if (!session) throw redirect(303, '/')

  const [ludo, member] = await Promise.all([
    getLudoById(session.ludoId),
    getMemberById(session.memberId),
  ])
  if (
    !ludo ||
    !member ||
    !isSessionStillValid(session, ludo) ||
    !isActiveMember(member) ||
    !belongsToLudo(member, ludo.id)
  ) {
    clearLudoSession(event.cookies)
    throw redirect(303, '/')
  }

  return { ludo, member }
}
