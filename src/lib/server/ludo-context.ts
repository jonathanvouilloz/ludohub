import { error, redirect, type RequestEvent } from '@sveltejs/kit'
import { getLudoBySlug } from './db/ludotheques.js'
import { getMemberById } from './db/members.js'
import { clearLudoSession } from './services/auth.js'
import { belongsToLudo, isActiveMember, isResponsable } from '$lib/utils/permissions.js'

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
  if (!session || session.ludoId !== ludo.id) {
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
