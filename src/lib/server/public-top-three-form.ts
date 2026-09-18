import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { requireLudoContext } from './ludo-context.js'
import {
  deletePublicSiteMedia,
  MediaStorageError,
  uploadPublicSiteMedia,
} from './media/blob-storage.js'
import { MediaCompensationError, uploadAndRegisterMedia } from './media/media-service.js'
import type { AuthorizedMediaScope } from './media/paths.js'
import { emitAuditEvent } from './services/events.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from './services/public-site.js'
import {
  authorizePublicTopThreeMediaScope,
  clearPublicTopThreeGameImage,
  deselectPublicTopThreeFromHomepage,
  PublicTopThreeServiceError,
  selectPublicTopThreeForHomepage,
  setPublicTopThreeGameImage,
  type PublicTopThreeEditableGame,
} from './services/public-top-threes.js'

/** Garde commune aux trois écrans Top 3 : session tenant puis module public activé. */
export async function requireTopThreeContext(event: RequestEvent) {
  const context = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(context.ludo.id))) throw error(404, 'Module indisponible')
  return context
}

export const TOP_GAME_IMAGE_POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
}

/** Positions fixes d'un Top 3 : trois jeux, ni plus ni moins. */
export const TOP_THREE_POSITIONS = [0, 1, 2] as const

export type TopThreeFormInput = {
  theme: string
  games: PublicTopThreeEditableGame[]
  /** Nouvelles photos à envoyer, par position. */
  files: Array<{ index: number; file: File }>
  /** Positions dont la photo doit être retirée. */
  removals: number[]
  isHomepage: boolean
}

/**
 * Lit le formulaire unique du Top 3 : nom, trois jeux, leurs photos et la mise en avant.
 * Ni slug ni ciblage de lieu : le premier se dérive du nom, le second vaut tous les lieux actifs.
 */
export function parseTopThreeForm(data: FormData): TopThreeFormInput {
  const games = TOP_THREE_POSITIONS.map((index) => {
    const name = String(data.get(`name${index}`) ?? '')
    const description = String(data.get(`description${index}`) ?? '').trim()
    return description ? { name, description } : { name }
  })

  const files: TopThreeFormInput['files'] = []
  for (const index of TOP_THREE_POSITIONS) {
    const file = data.get(`image${index}`)
    if (file instanceof File && file.size > 0) files.push({ index, file })
  }

  const replaced = new Set(files.map((entry) => entry.index))
  const removals = TOP_THREE_POSITIONS.filter(
    (index) => data.has(`removeImage${index}`) && !replaced.has(index),
  )

  return {
    theme: String(data.get('theme') ?? ''),
    games,
    files,
    removals,
    isHomepage: data.get('isHomepage') === 'true',
  }
}

export function revisionInput(data: FormData) {
  const revision = Number(data.get('revision'))
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new PublicTopThreeServiceError('La version du Top 3 est invalide. Rechargez la page.')
  }
  return revision
}

export async function run(action: () => Promise<unknown>) {
  try {
    return await action()
  } catch (cause) {
    if (
      cause instanceof PublicTopThreeServiceError ||
      cause instanceof PublicSiteServiceError ||
      cause instanceof MediaStorageError
    ) {
      return fail(400, { error: cause.message })
    }
    if (cause instanceof MediaCompensationError) return fail(500, { error: cause.message })
    throw cause
  }
}

export async function audit(input: {
  action: string
  ludoId: string
  memberId: string
  topThreeId: string
  metadata?: Record<string, unknown>
}) {
  await emitAuditEvent({
    action: input.action,
    actorLudoId: input.ludoId,
    actorMemberId: input.memberId,
    entityType: 'public_top_three',
    entityId: input.topThreeId,
    metadata: input.metadata,
  })
}

async function cleanupTopGameImage(input: {
  scope: AuthorizedMediaScope
  pathname: string | null
  ludoId: string
  memberId: string
  topThreeId: string
  operation: 'replace' | 'remove' | 'delete'
}) {
  if (!input.pathname) return
  try {
    await deletePublicSiteMedia(input.scope, input.pathname)
  } catch (cause) {
    console.error(
      '[public-top-three] image cleanup failed',
      { topThreeId: input.topThreeId },
      cause,
    )
    await audit({
      action: 'public_top_three.image_cleanup_failed',
      ludoId: input.ludoId,
      memberId: input.memberId,
      topThreeId: input.topThreeId,
      metadata: { operation: input.operation },
    })
  }
}

/** Le texte alternatif n'est plus saisi par le staff : il se déduit du nom du jeu. */
function imageAlt(name: string | undefined) {
  return `Boîte du jeu ${(name ?? '').trim()}`.trim().slice(0, 300)
}

export async function cleanupTopThreeImages(input: {
  scope: AuthorizedMediaScope
  pathnames: Array<string | null | undefined>
  ludoId: string
  memberId: string
  topThreeId: string
}) {
  await Promise.all(
    input.pathnames.map((pathname) =>
      cleanupTopGameImage({
        scope: input.scope,
        pathname: pathname ?? null,
        ludoId: input.ludoId,
        memberId: input.memberId,
        topThreeId: input.topThreeId,
        operation: 'delete',
      }),
    ),
  )
}

/**
 * Applique les photos position par position en propageant la révision retournée :
 * chaque écriture incrémente le compteur CAS du Top 3.
 */
export async function syncTopThreeGameImages(input: {
  ludoId: string
  memberId: string
  topThreeId: string
  revision: number
  files: TopThreeFormInput['files']
  removals: number[]
  games: PublicTopThreeEditableGame[]
}) {
  const { ludoId, memberId, topThreeId } = input
  let revision = input.revision
  const updated: number[] = []
  const removed: number[] = []

  for (const { index, file } of input.files) {
    const current = revision
    const result = await uploadAndRegisterMedia({
      authorize: () => authorizePublicTopThreeMediaScope(ludoId, topThreeId, current),
      upload: (scope) => uploadPublicSiteMedia({ scope, file, policy: TOP_GAME_IMAGE_POLICY }),
      register: (scope, blob) =>
        setPublicTopThreeGameImage(
          ludoId,
          topThreeId,
          memberId,
          current,
          index,
          scope,
          blob,
          imageAlt(input.games[index]?.name),
        ),
      cleanup: deletePublicSiteMedia,
    })
    revision = result.topThree.revision
    await cleanupTopGameImage({
      scope: await authorizePublicTopThreeMediaScope(ludoId, topThreeId, revision),
      pathname: result.previousStorageKey,
      ludoId,
      memberId,
      topThreeId,
      operation: 'replace',
    })
    updated.push(index)
  }

  for (const index of input.removals) {
    const scope = await authorizePublicTopThreeMediaScope(ludoId, topThreeId, revision)
    const result = await clearPublicTopThreeGameImage(ludoId, topThreeId, memberId, revision, index)
    revision = result.topThree.revision
    await cleanupTopGameImage({
      scope,
      pathname: result.previousStorageKey,
      ludoId,
      memberId,
      topThreeId,
      operation: 'remove',
    })
    removed.push(index)
  }

  return { revision, updated, removed }
}

/** Une seule mise en avant par ludothèque : la sélection retire automatiquement l'ancienne. */
export async function syncTopThreeHomepage(input: {
  ludoId: string
  memberId: string
  topThreeId: string
  revision: number
  wanted: boolean
  current: boolean
}) {
  if (input.wanted === input.current) {
    return { revision: input.revision, changed: false, isHomepage: input.current }
  }
  const selection = input.wanted
    ? await selectPublicTopThreeForHomepage(
        input.topThreeId,
        input.ludoId,
        input.memberId,
        input.revision,
      )
    : await deselectPublicTopThreeFromHomepage(
        input.topThreeId,
        input.ludoId,
        input.memberId,
        input.revision,
      )
  return {
    revision: selection.topThree.revision,
    changed: selection.changed,
    isHomepage: selection.topThree.isHomepage,
  }
}
