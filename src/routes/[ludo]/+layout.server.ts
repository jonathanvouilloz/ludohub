import { error, redirect } from '@sveltejs/kit'
import { getLudoBySlug } from '$lib/server/db/ludotheques.js'
import { getMemberById } from '$lib/server/db/members.js'
import { clearLudoSession } from '$lib/server/services/auth.js'
import { isActiveMember, belongsToLudo } from '$lib/utils/permissions.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ params, locals, cookies }) => {
  const ludo = await getLudoBySlug(params.ludo)
  if (!ludo) throw error(404, 'Ludothèque introuvable')

  const session = locals.ludoSession
  if (!session || session.ludoId !== ludo.id) {
    throw redirect(303, `/auth/${params.ludo}`)
  }

  const member = await getMemberById(session.memberId)
  if (!member || !isActiveMember(member) || !belongsToLudo(member, ludo.id)) {
    clearLudoSession(cookies)
    throw redirect(303, `/auth/${params.ludo}`)
  }

  locals.ludo = ludo
  locals.currentMember = member

  return { ludo, currentMember: member }
}
