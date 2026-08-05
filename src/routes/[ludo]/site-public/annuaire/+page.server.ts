import { error, fail, type RequestEvent } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import {
  createPublicDirectoryEntry,
  deleteDraftPublicDirectoryEntry,
  hidePublicDirectoryEntry,
  listPublicDirectoryForManagement,
  publishPublicDirectoryEntry,
  PublicDirectoryServiceError,
  type PublicDirectoryInput,
  type PublicDirectoryUpdateInput,
  updatePublicDirectoryEntry,
} from '$lib/server/services/public-directory.js'
import { emitAuditEvent } from '$lib/server/services/events.js'
import { isPublicSiteEnabled, PublicSiteServiceError } from '$lib/server/services/public-site.js'
import type { Actions, PageServerLoad } from './$types'

async function context(event: RequestEvent) {
  const value = await requireLudoContext(event)
  if (!(await isPublicSiteEnabled(value.ludo.id))) throw error(404, 'Module indisponible')
  return value
}
function optional(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim() || null
}
function input(data: FormData): PublicDirectoryInput {
  return {
    slug: String(data.get('slug') ?? ''),
    name: String(data.get('name') ?? ''),
    descriptionMarkdown: optional(data, 'descriptionMarkdown'),
    address: optional(data, 'address'),
    postalCode: optional(data, 'postalCode'),
    city: String(data.get('city') ?? ''),
    phone: optional(data, 'phone'),
    email: optional(data, 'email'),
    website: optional(data, 'website'),
    directionsUrl: String(data.get('directionsUrl') ?? ''),
    officialUrl: String(data.get('officialUrl') ?? ''),
    sortOrder: Number(data.get('sortOrder')),
  }
}
function updateInput(data: FormData): PublicDirectoryUpdateInput {
  return { ...input(data), ...(data.has('slug') ? {} : { slug: undefined }) }
}
function revision(data: FormData) {
  const value = Number(data.get('revision'))
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PublicDirectoryServiceError('Révision invalide.')
  return value
}
async function run(callback: () => Promise<unknown>) {
  try {
    return await callback()
  } catch (cause) {
    if (cause instanceof PublicDirectoryServiceError || cause instanceof PublicSiteServiceError)
      return fail(400, { error: cause.message })
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
    entityType: 'public_directory_entry',
    entityId: id,
    metadata,
  })
}
export const load: PageServerLoad = async (event) => {
  const { ludo } = await context(event)
  return { entries: await listPublicDirectoryForManagement(ludo.id) }
}
export const actions: Actions = {
  create: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    return run(async () => {
      const parsed = input(data)
      const entry = await createPublicDirectoryEntry(ludo.id, member.id, parsed)
      await audit('public_directory.created', ludo.id, member.id, entry.id, {
        sortOrder: parsed.sortOrder,
        hasDirectionsUrl: Boolean(
          (parsed as PublicDirectoryInput & { directionsUrl?: string | null }).directionsUrl,
        ),
        hasOfficialUrl: Boolean(
          (parsed as PublicDirectoryInput & { officialUrl?: string | null }).officialUrl,
        ),
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
      const entry = await updatePublicDirectoryEntry(id, ludo.id, parsed, member.id, revision(data))
      await audit('public_directory.updated', ludo.id, member.id, entry.id, {
        sortOrder: parsed.sortOrder,
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
        throw new PublicDirectoryServiceError('Transition invalide.')
      const result =
        next === 'published'
          ? await publishPublicDirectoryEntry(id, ludo.id, member.id, revision(data))
          : await hidePublicDirectoryEntry(id, ludo.id, member.id, revision(data))
      if (result.changed)
        await audit(
          next === 'published' ? 'public_directory.published' : 'public_directory.hidden',
          ludo.id,
          member.id,
          result.entry.id,
          { fromStatus: result.previousStatus, toStatus: result.entry.status },
        )
      return { success: true }
    })
  },
  delete: async (event) => {
    const { ludo, member } = await context(event)
    const data = await event.request.formData()
    const id = String(data.get('id') ?? '')
    return run(async () => {
      await deleteDraftPublicDirectoryEntry(id, ludo.id, revision(data))
      await audit('public_directory.deleted', ludo.id, member.id, id)
      return { success: true }
    })
  },
}
