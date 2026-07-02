import { redirect } from '@sveltejs/kit'
import { getAllLudos } from '$lib/server/db/ludotheques.js'
import { resolveSessionContext } from '$lib/server/ludo-context.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  // Déjà connecté (le PWA démarre sur `/`) → droit au dashboard de sa ludo,
  // sans repasser par le sélecteur ni le mot de passe.
  const ctx = await resolveSessionContext(event)
  if (ctx) throw redirect(303, `/${ctx.ludo.slug}`)

  const ludos = await getAllLudos()
  return {
    ludos: ludos.map((l) => ({ name: l.name, slug: l.slug, color: l.color })),
  }
}
