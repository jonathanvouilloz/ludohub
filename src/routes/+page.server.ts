import { getAllLudos } from '$lib/server/db/ludotheques.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  const ludos = await getAllLudos()
  return {
    ludos: ludos.map((l) => ({ name: l.name, slug: l.slug, color: l.color })),
  }
}
