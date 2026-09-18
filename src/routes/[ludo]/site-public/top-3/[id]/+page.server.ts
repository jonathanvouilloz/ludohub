import { error } from '@sveltejs/kit'
import {
  audit,
  parseTopThreeForm,
  requireTopThreeContext,
  revisionInput,
  run,
  syncTopThreeGameImages,
  syncTopThreeHomepage,
} from '$lib/server/public-top-three-form.js'
import {
  getPublicTopThree,
  publishPublicTopThree,
  PublicTopThreeServiceError,
  updatePublicTopThree,
} from '$lib/server/services/public-top-threes.js'
import type { Actions, PageServerLoad } from './$types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireTopThreeContext(event)
  if (!UUID.test(event.params.id)) throw error(404, 'Top 3 introuvable')
  try {
    return { topThree: await getPublicTopThree(event.params.id, ludo.id) }
  } catch (cause) {
    if (cause instanceof PublicTopThreeServiceError) throw error(404, 'Top 3 introuvable')
    throw cause
  }
}

export const actions: Actions = {
  update: async (event) => {
    const { ludo, member } = await requireTopThreeContext(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const input = parseTopThreeForm(data)
      const updated = await updatePublicTopThree(
        id,
        ludo.id,
        { theme: input.theme, games: input.games },
        member.id,
        revisionInput(data),
      )
      await audit({
        action: 'public_top_three.updated',
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
        metadata: { gameCount: input.games.length },
      })

      const images = await syncTopThreeGameImages({
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
        revision: updated.revision,
        files: input.files,
        removals: input.removals,
        games: input.games,
      })
      for (const position of images.updated) {
        await audit({
          action: 'public_top_three.game_image_updated',
          ludoId: ludo.id,
          memberId: member.id,
          topThreeId: id,
          metadata: { position: position + 1 },
        })
      }
      for (const position of images.removed) {
        await audit({
          action: 'public_top_three.game_image_removed',
          ludoId: ludo.id,
          memberId: member.id,
          topThreeId: id,
          metadata: { position: position + 1 },
        })
      }

      // Lignes héritées du cycle brouillon/masqué : un enregistrement les met en ligne.
      let revision = images.revision
      if (updated.status !== 'published') {
        const transition = await publishPublicTopThree(id, ludo.id, member.id, revision)
        revision = transition.topThree.revision
        if (transition.changed) {
          await audit({
            action: 'public_top_three.published',
            ludoId: ludo.id,
            memberId: member.id,
            topThreeId: id,
            metadata: { fromStatus: transition.previousStatus, toStatus: 'published' },
          })
        }
      }

      const homepage = await syncTopThreeHomepage({
        ludoId: ludo.id,
        memberId: member.id,
        topThreeId: id,
        revision,
        wanted: input.isHomepage,
        current: updated.isHomepage,
      })
      if (homepage.changed) {
        await audit({
          action: homepage.isHomepage
            ? 'public_top_three.homepage_selected'
            : 'public_top_three.homepage_deselected',
          ludoId: ludo.id,
          memberId: member.id,
          topThreeId: id,
          metadata: { isHomepage: homepage.isHomepage },
        })
      }

      return { success: true }
    })
  },
}
