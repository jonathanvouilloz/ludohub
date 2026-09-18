import {
  audit,
  cleanupTopThreeImages,
  requireTopThreeContext,
  revisionInput,
  run,
} from '$lib/server/public-top-three-form.js'
import {
  authorizePublicTopThreeMediaScope,
  getPublicTopThree,
  listPublicTopThreesForManagement,
  permanentlyDeletePublicTopThree,
} from '$lib/server/services/public-top-threes.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireTopThreeContext(event)
  return { topThrees: await listPublicTopThreesForManagement(ludo.id) }
}

export const actions: Actions = {
  delete: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const revision = revisionInput(data)
      const [scope, topThree] = await Promise.all([
        authorizePublicTopThreeMediaScope(ludo.id, id, revision),
        getPublicTopThree(id, ludo.id),
      ])
      await permanentlyDeletePublicTopThree(id, ludo.id, revision)
      await cleanupTopThreeImages({
        scope,
        pathnames: topThree.games.map((game) => game.imageStorageKey),
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
      })
      await audit({
        action: 'public_top_three.deleted',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
      })
      return { success: true }
    })
  },
}
