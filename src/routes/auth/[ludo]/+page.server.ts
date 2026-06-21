import { error, fail, redirect } from '@sveltejs/kit'
import { getLudoBySlug } from '$lib/server/db/ludotheques.js'
import { verifyLudoPassword, setLudoSessionCookie } from '$lib/server/services/auth.js'
import { checkRateLimit } from '$lib/server/services/rate-limit.js'
import { isActiveMember } from '$lib/utils/permissions.js'
import type { Actions, PageServerLoad } from './$types'

const GENERIC_ERROR = 'Identifiants incorrects'
const RATE_LIMITED = 'Trop de tentatives. Réessayez dans quelques minutes.'

export const load: PageServerLoad = async ({ params, locals }) => {
  const ludo = await getLudoBySlug(params.ludo)
  if (!ludo) throw error(404, 'Ludothèque introuvable')

  // Déjà connecté à cette ludo → dashboard
  if (locals.ludoSession?.ludoId === ludo.id) {
    throw redirect(303, `/${params.ludo}`)
  }

  return { ludoName: ludo.name, ludoColor: ludo.color }
}

export const actions: Actions = {
  // Étape 1 : vérifier le mot de passe partagé → renvoyer les membres actifs
  checkPassword: async ({ request, params, getClientAddress }) => {
    // 10 essais / 15 min par IP+ludo : freine le brute-force du mot de passe partagé.
    const limit = checkRateLimit(
      `ludo-login:${getClientAddress()}:${params.ludo}`,
      10,
      15 * 60 * 1000,
    )
    if (!limit.ok) return fail(429, { error: RATE_LIMITED })

    const data = await request.formData()
    const password = String(data.get('password') ?? '')

    const result = await verifyLudoPassword(params.ludo, password)
    if (!result) return fail(401, { error: GENERIC_ERROR })

    return {
      step: 'pick' as const,
      password,
      members: result.members,
    }
  },

  // Étape 2 : valider membre + re-vérifier le password → poser la session
  login: async ({ request, params, cookies }) => {
    const data = await request.formData()
    const password = String(data.get('password') ?? '')
    const memberId = String(data.get('memberId') ?? '')

    const result = await verifyLudoPassword(params.ludo, password)
    if (!result) return fail(401, { error: GENERIC_ERROR })

    const member = result.members.find((m) => m.id === memberId)
    if (!member || !isActiveMember(member)) {
      return fail(400, {
        step: 'pick' as const,
        password,
        members: result.members,
        error: 'Membre invalide, réessayez.',
      })
    }

    await setLudoSessionCookie(
      cookies,
      { ludoId: result.ludo.id, memberId: member.id },
      result.ludo.passwordHash,
    )
    throw redirect(303, `/${params.ludo}`)
  },
}
