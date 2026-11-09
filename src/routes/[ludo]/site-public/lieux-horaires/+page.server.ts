import { fail } from '@sveltejs/kit'

// Les lieux et horaires font partie des informations administrées pour le site public.
import { requireLudoContext, requireResponsableContext } from '$lib/server/ludo-context.js'
import {
  createSiteWithOpeningHours,
  deleteSite,
  listSitesWithOpeningHours,
  reorderSites,
  SiteServiceError,
  updateSiteWithOpeningHours,
  authorizeSiteMediaScope,
  setSitePhoto,
  clearSitePhoto,
  getSiteByIdForLudo,
  isSitePhotoUnreferenced,
} from '$lib/server/services/sites.js'
import {
  deletePublicSiteMedia,
  uploadPublicSiteMedia,
  MediaStorageError,
} from '$lib/server/media/blob-storage.js'
import { uploadAndRegisterMedia, MediaCompensationError } from '$lib/server/media/media-service.js'
import type { AuthorizedMediaScope } from '$lib/server/media/paths.js'
import { isResponsable } from '$lib/utils/permissions.js'
import { OpeningHoursValidationError, parseOpeningHours } from '$lib/utils/opening-hours.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  const { ludo, member } = await requireLudoContext(event)
  return {
    sites: await listSitesWithOpeningHours(ludo.id),
    canEdit: isResponsable(member),
  }
}

function optionalText(data: FormData, key: string): string | null {
  const value = String(data.get(key) ?? '').trim()
  return value || null
}

function expectedPhotoReference(data: FormData): string | null {
  const value = data.get('expectedPhotoStorageKey')
  if (typeof value !== 'string' || value.length > 1000)
    throw new SiteServiceError('La référence photo manque ou est invalide. Rechargez le lieu.')
  return value || null
}

function optionalCoordinate(data: FormData, key: string): number | null {
  const raw = String(data.get(key) ?? '').trim()
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new SiteServiceError('Les coordonnées sont invalides.')
  return value
}

async function run(operation: () => Promise<unknown>, unknownErrorMessage?: string) {
  try {
    await operation()
    return { success: true }
  } catch (error) {
    if (
      error instanceof SiteServiceError ||
      error instanceof OpeningHoursValidationError ||
      error instanceof MediaStorageError
    ) {
      return fail(400, { error: error.message })
    }
    if (error instanceof MediaCompensationError) return fail(500, { error: error.message })
    if (unknownErrorMessage) return fail(500, { error: unknownErrorMessage })
    throw error
  }
}

async function cleanupPhoto(scope: AuthorizedMediaScope, pathname: string | null) {
  if (!pathname) return
  try {
    await deletePublicSiteMedia(scope, pathname)
  } catch (error) {
    // A saved photo must remain saved even when deleting its predecessor fails.
    console.error('[site-photo] Previous media cleanup failed', { siteId: scope.entityId, error })
  }
}

export const actions: Actions = {
  uploadPhoto: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(async () => {
      const siteId = String(data.get('siteId') ?? '')
      const expectedStorageKey = expectedPhotoReference(data)
      const file = data.get('photoFile')
      if (!(file instanceof File) || file.size === 0)
        throw new SiteServiceError('Sélectionnez une photo.')
      const current = await getSiteByIdForLudo(siteId, ludo.id)
      if (!current) throw new SiteServiceError('Lieu introuvable.')
      if (current.photoStorageKey !== expectedStorageKey)
        throw new SiteServiceError('La photo a été modifiée simultanément. Rechargez le lieu.')
      let registrationDefinitelyRejected = false
      const registered = await uploadAndRegisterMedia({
        authorize: () => authorizeSiteMediaScope(ludo.id, siteId),
        upload: (scope) =>
          uploadPublicSiteMedia({
            scope,
            file,
            policy: {
              maxBytes: 5 * 1024 * 1024,
              allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
            },
          }),
        register: async (scope, blob) => {
          try {
            return {
              scope,
              result: await setSitePhoto(
                ludo.id,
                siteId,
                scope,
                blob,
                String(data.get('photoAlt') ?? ''),
                expectedStorageKey,
              ),
            }
          } catch (error) {
            // Only validation/CAS-zero errors prove that this request did not commit.
            registrationDefinitelyRejected = error instanceof SiteServiceError
            throw error
          }
        },
        cleanup: async (scope, pathname) => {
          const unreferenced = await isSitePhotoUnreferenced(scope, pathname)
          if (registrationDefinitelyRejected && unreferenced)
            await deletePublicSiteMedia(scope, pathname)
          else if (!registrationDefinitelyRejected)
            console.warn('[site-photo] Uncertain registration; preserving uploaded media', {
              siteId: scope.entityId,
              pathname,
            })
        },
      })
      await cleanupPhoto(registered.scope, registered.result.previousStorageKey)
    }, 'L’enregistrement de la photo n’a pas pu être confirmé. Rechargez le lieu pour vérifier la photo avant de réessayer.')
  },

  removePhoto: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(async () => {
      const siteId = String(data.get('siteId') ?? '')
      const expectedStorageKey = expectedPhotoReference(data)
      const scope = await authorizeSiteMediaScope(ludo.id, siteId)
      const result = await clearSitePhoto(ludo.id, siteId, expectedStorageKey)
      await cleanupPhoto(scope, result.previousStorageKey)
    }, 'Le retrait de la photo n’a pas pu être confirmé. Rechargez le lieu pour vérifier le retrait avant de réessayer.')
  },
  create: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()

    return run(() =>
      createSiteWithOpeningHours(ludo.id, {
        slug: String(data.get('slug') ?? ''),
        name: String(data.get('name') ?? ''),
        address: optionalText(data, 'address'),
        postalCode: optionalText(data, 'postalCode'),
        city: optionalText(data, 'city'),
        phone: optionalText(data, 'phone'),
        email: optionalText(data, 'email'),
        accessInfo: optionalText(data, 'accessInfo'),
        importantInfo: optionalText(data, 'importantInfo'),
        directionsUrl: optionalText(data, 'directionsUrl'),
        latitude: optionalCoordinate(data, 'latitude'),
        longitude: optionalCoordinate(data, 'longitude'),
        isPrimary: data.has('isPrimary'),
        isActive: data.has('isActive'),
        openingIntervals: parseOpeningHours(data.get('openingHours')),
      }),
    )
  },

  update: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const siteId = String(data.get('siteId') ?? '')

    return run(() =>
      updateSiteWithOpeningHours(ludo.id, siteId, {
        slug: String(data.get('slug') ?? ''),
        name: String(data.get('name') ?? ''),
        address: optionalText(data, 'address'),
        postalCode: optionalText(data, 'postalCode'),
        city: optionalText(data, 'city'),
        phone: optionalText(data, 'phone'),
        email: optionalText(data, 'email'),
        accessInfo: optionalText(data, 'accessInfo'),
        importantInfo: optionalText(data, 'importantInfo'),
        directionsUrl: optionalText(data, 'directionsUrl'),
        latitude: optionalCoordinate(data, 'latitude'),
        longitude: optionalCoordinate(data, 'longitude'),
        isPrimary: data.has('isPrimary'),
        isActive: data.has('isActive'),
        openingIntervals: parseOpeningHours(data.get('openingHours')),
      }),
    )
  },

  reorder: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(async () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(data.get('orderedIds') ?? '[]'))
      } catch {
        throw new SiteServiceError("L'ordre des lieux est invalide.")
      }
      if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string')) {
        throw new SiteServiceError("L'ordre des lieux est invalide.")
      }
      await reorderSites(ludo.id, parsed)
    })
  },

  delete: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    return run(async () => {
      const siteId = String(data.get('siteId') ?? '')
      const scope = await authorizeSiteMediaScope(ludo.id, siteId)
      const deleted = await deleteSite(ludo.id, siteId)
      await cleanupPhoto(scope, deleted.photoStorageKey ?? null)
    })
  },
}
