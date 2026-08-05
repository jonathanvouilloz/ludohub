import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { listSiteRowsWithOpeningHours } from '$lib/server/db/sites.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import {
  deletePublicSiteMedia,
  MediaStorageError,
  uploadPublicSiteMedia,
} from '$lib/server/media/blob-storage.js'
import { MediaCompensationError, uploadAndRegisterMedia } from '$lib/server/media/media-service.js'
import type { AuthorizedMediaScope } from '$lib/server/media/paths.js'
import {
  authorizePublicDocumentMediaScope,
  clearPublicDocumentPdf,
  createPublicDocument,
  deleteDraftPublicDocument,
  hidePublicDocument,
  listPublicDocumentsForManagement,
  publishPublicDocument,
  PublicDocumentServiceError,
  type PublicDocumentInput,
  setPublicDocumentPdf,
  updatePublicDocument,
} from '$lib/server/services/public-documents.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import type { Actions, PageServerLoad } from './$types'

async function context(event: RequestEvent) {
  const value = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(value.ludo.id))) throw error(404, 'Module indisponible')
  return value
}
function targets(data: FormData) {
  const targetMode = data.get('targetMode')
  const siteIds = data.getAll('siteIds').map(String)
  if (targetMode === 'all') {
    if (siteIds.length)
      throw new PublicDocumentServiceError('Le ciblage global ne prend pas de lieu précis.')
    return { targetMode, siteIds: [] } as const
  }
  if (targetMode === 'explicit') {
    if (!siteIds.length)
      throw new PublicDocumentServiceError('Sélectionnez au moins un lieu actif.')
    return { targetMode, siteIds } as const
  }
  throw new PublicDocumentServiceError('Choisissez le mode de ciblage.')
}
function kind(data: FormData): PublicDocumentInput['kind'] {
  const value = data.get('kind')
  if (value !== 'mission' && value !== 'statutes' && value !== 'annual_report' && value !== 'other')
    throw new PublicDocumentServiceError('Type de document invalide.')
  return value
}
function input(data: FormData): PublicDocumentInput {
  const documentKind = kind(data)
  return {
    slug: String(data.get('slug') ?? ''),
    kind: documentKind,
    title: String(data.get('title') ?? ''),
    summary: String(data.get('summary') ?? '').trim() || null,
    bodyMarkdown: String(data.get('bodyMarkdown') ?? '').trim() || null,
    year: documentKind === 'annual_report' ? Number(data.get('year')) : null,
    ...targets(data),
  }
}
function updateInput(data: FormData) {
  return { ...input(data), ...(data.has('slug') ? {} : { slug: undefined }) }
}
function revision(data: FormData) {
  const value = Number(data.get('revision'))
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PublicDocumentServiceError('Révision invalide.')
  return value
}
async function run(callback: () => Promise<unknown>) {
  try {
    return await callback()
  } catch (cause) {
    if (
      cause instanceof PublicDocumentServiceError ||
      cause instanceof PublicSiteServiceError ||
      cause instanceof MediaStorageError
    )
      return fail(400, { error: cause.message })
    if (cause instanceof MediaCompensationError) return fail(500, { error: cause.message })
    throw cause
  }
}
async function audit(
  action: string,
  ludoId: string,
  memberId: string,
  id: string,
  metadata?: Record<string, unknown>,
) {
  await emitAuditEvent({
    action,
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'public_document',
    entityId: id,
    metadata,
  })
}
async function cleanup(
  scope: AuthorizedMediaScope,
  pathname: string | null,
  ludoId: string,
  memberId: string,
  id: string,
  operation: string,
) {
  if (!pathname) return
  try {
    await deletePublicSiteMedia(scope, pathname)
  } catch (cause) {
    console.error('[public-document] PDF cleanup failed', { id }, cause)
    await audit('public_document.pdf_cleanup_failed', ludoId, memberId, id, { operation })
  }
}
const PDF_POLICY = { maxBytes: 15 * 1024 * 1024, allowedTypes: ['application/pdf'] as const }

export const load: PageServerLoad = async (event) => {
  const { ludo } = await context(event)
  const [documents, sites] = await Promise.all([
    listPublicDocumentsForManagement(ludo.id),
    listSiteRowsWithOpeningHours(ludo.id),
  ])
  return { documents, sites }
}
export const actions: Actions = {
  create: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    return run(async () => {
      const parsed = input(data)
      const document = await createPublicDocument(ludo.id, member.id, parsed)
      await audit('public_document.created', ludo.id, member.id, document.id, {
        kind: parsed.kind,
        year: parsed.year,
        targetMode: parsed.targetMode,
        targetSiteIds: parsed.siteIds,
        hasSummary: parsed.summary !== null,
        hasBody: parsed.bodyMarkdown !== null,
      })
      return { success: true }
    })
  },
  update: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const parsed = updateInput(data)
      const document = await updatePublicDocument(id, ludo.id, parsed, member.id, revision(data))
      await audit('public_document.updated', ludo.id, member.id, document.id, {
        kind: parsed.kind,
        year: parsed.year,
        targetMode: parsed.targetMode,
        targetSiteIds: parsed.siteIds,
        hasSummary: parsed.summary !== null,
        hasBody: parsed.bodyMarkdown !== null,
      })
      return { success: true }
    })
  },
  publication: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const next = data.get('status')
      if (next !== 'published' && next !== 'hidden')
        throw new PublicDocumentServiceError('Transition invalide.')
      const transition =
        next === 'published'
          ? await publishPublicDocument(id, ludo.id, member.id, revision(data))
          : await hidePublicDocument(id, ludo.id, member.id, revision(data))
      if (transition.changed)
        await audit(
          next === 'published' ? 'public_document.published' : 'public_document.hidden',
          ludo.id,
          member.id,
          transition.document.id,
          { fromStatus: transition.previousStatus, toStatus: transition.document.status },
        )
      return { success: true }
    })
  },
  delete: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const rev = revision(data)
      const scope = await authorizePublicDocumentMediaScope(ludo.id, id, rev)
      const result = await deleteDraftPublicDocument(id, ludo.id, rev)
      await cleanup(scope, result.previousStorageKey, ludo.id, member.id, id, 'delete')
      await audit('public_document.deleted', ludo.id, member.id, id)
      return { success: true }
    })
  },
  uploadFile: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const rev = revision(data)
      const file = data.get('file')
      if (!(file instanceof File)) throw new MediaStorageError('Sélectionnez un PDF.')
      const registered = await uploadAndRegisterMedia({
        authorize: () => authorizePublicDocumentMediaScope(ludo.id, id, rev),
        upload: (scope) => uploadPublicSiteMedia({ scope, file, policy: PDF_POLICY }),
        register: async (scope, blob) => ({
          scope,
          result: await setPublicDocumentPdf(ludo.id, id, member.id, rev, scope, blob, file.name),
        }),
        cleanup: deletePublicSiteMedia,
      })
      await cleanup(
        registered.scope,
        registered.result.previousStorageKey,
        ludo.id,
        member.id,
        id,
        'replace',
      )
      await audit('public_document.pdf_updated', ludo.id, member.id, id)
      return { success: true }
    })
  },
  removeFile: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      const rev = revision(data)
      const scope = await authorizePublicDocumentMediaScope(ludo.id, id, rev)
      const result = await clearPublicDocumentPdf(ludo.id, id, member.id, rev)
      await cleanup(scope, result.previousStorageKey, ludo.id, member.id, id, 'remove')
      await audit('public_document.pdf_removed', ludo.id, member.id, id)
      return { success: true }
    })
  },
}
