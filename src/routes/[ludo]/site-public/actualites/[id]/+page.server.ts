import { error, fail, redirect } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { deletePublicSiteMedia } from '$lib/server/media/blob-storage.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import {
  authorizePublicNewsMediaScope,
  getPublicNews,
  permanentlyDeletePublicNews,
  PublicNewsServiceError,
} from '$lib/server/services/public-news.js'
import { isPublicSiteEnabled } from '$lib/server/services/public-site.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(ludo.id))) throw error(404, 'Module indisponible')
  try {
    return { news: await getPublicNews(event.params.id, ludo.id) }
  } catch (cause) {
    if (cause instanceof PublicNewsServiceError) throw error(404, 'Actualité introuvable')
    throw cause
  }
}

/** La suppression vit sur la route de fiche : aucune action réexportée fragile. */
export const actions: Actions = {
  delete: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    if (!(await isPublicSiteEnabled(ludo.id))) throw error(404, 'Module indisponible')
    const revision = Number((await event.request.formData()).get('revision'))
    if (!Number.isSafeInteger(revision) || revision < 1)
      return fail(400, { error: 'La version de l’actualité est invalide. Rechargez la page.' })
    try {
      const [scope, news] = await Promise.all([
        authorizePublicNewsMediaScope(ludo.id, event.params.id, revision),
        getPublicNews(event.params.id, ludo.id),
      ])
      await permanentlyDeletePublicNews(event.params.id, ludo.id, revision)
      await Promise.allSettled(
        [news.imageStorageKey, ...news.assets.map((asset) => asset.storageKey)]
          .filter((key): key is string => Boolean(key))
          .map((pathname) => deletePublicSiteMedia(scope, pathname)),
      )
      await emitAuditEvent({
        action: 'public_news.deleted', actorLudoId: ludo.id, actorMemberId: member.id,
        entityType: 'public_news', entityId: event.params.id,
      })
    } catch (cause) {
      if (cause instanceof PublicNewsServiceError) return fail(400, { error: cause.message })
      throw cause
    }
    throw redirect(303, `/${ludo.slug}/site-public/actualites`)
  },
}
