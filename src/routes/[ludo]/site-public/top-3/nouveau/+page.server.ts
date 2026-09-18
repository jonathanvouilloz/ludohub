import {
  audit,
  parseTopThreeForm,
  requireTopThreeContext,
  run,
  syncTopThreeGameImages,
  syncTopThreeHomepage,
} from '$lib/server/public-top-three-form.js'
import { createPublicTopThree } from '$lib/server/services/public-top-threes.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  await requireTopThreeContext(event)
  return {}
}

export const actions: Actions = {
  create: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    return run(async () => {
      const input = parseTopThreeForm(data)
      const topThree = await createPublicTopThree(ludo.id, member.id, {
        theme: input.theme,
        games: input.games,
        targetMode: 'all',
        siteIds: [],
        publish: true,
      })
      await audit({
        action: 'public_top_three.created',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: topThree.id,
        metadata: { gameCount: input.games.length, published: true },
      })

      const images = await syncTopThreeGameImages({
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: topThree.id,
        revision: topThree.revision,
        files: input.files,
        removals: [],
        games: input.games,
      })
      for (const position of images.updated) {
        await audit({
          action: 'public_top_three.game_image_updated',
          ludoId: ludo.id,
          memberId: member.id,
          topThreeId: topThree.id,
          metadata: { position: position + 1, hadPreviousImage: false },
        })
      }

      const homepage = await syncTopThreeHomepage({
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: topThree.id,
        revision: images.revision,
        wanted: input.isHomepage,
        current: false,
      })
      if (homepage.changed) {
        await audit({
          action: 'public_top_three.homepage_selected',
          ludoId: ludo.id,
          memberId: member.id,
          topThreeId: topThree.id,
          metadata: { isHomepage: true },
        })
      }

      return { success: true }
    })
  },
}
