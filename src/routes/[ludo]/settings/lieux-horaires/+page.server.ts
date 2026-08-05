import { fail } from '@sveltejs/kit'
import { requireLudoContext, requireResponsableContext } from '$lib/server/ludo-context.js'
import {
  listSitesWithOpeningHours,
  reorderSites,
  SiteServiceError,
  updateSiteWithOpeningHours,
} from '$lib/server/services/sites.js'
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

function optionalCoordinate(data: FormData, key: string): number | null {
  const raw = String(data.get(key) ?? '').trim()
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new SiteServiceError('Les coordonnées sont invalides.')
  return value
}

async function run(operation: () => Promise<unknown>) {
  try {
    await operation()
    return { success: true }
  } catch (error) {
    if (error instanceof SiteServiceError || error instanceof OpeningHoursValidationError) {
      return fail(400, { error: error.message })
    }
    throw error
  }
}

export const actions: Actions = {
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
}
