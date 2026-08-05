import { randomUUID } from 'node:crypto'
import {
  getSiteRowForLudo,
  insertSiteWithIntervalsAtomic,
  listActiveSiteRows,
  listSiteRowsWithOpeningHours,
  updateSiteWithIntervalsAtomic,
  updateSiteOrderRows,
} from '../db/sites.js'
import type { LudoSiteRow, SiteOpeningIntervalRow } from '../schema.js'

export class SiteServiceError extends Error {}

export type OpeningIntervalInput = {
  dayOfWeek: number
  opensAt: string
  closesAt: string
}

export type SiteInput = {
  slug: string
  name: string
  address?: string | null
  postalCode?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  accessInfo?: string | null
  latitude?: number | null
  longitude?: number | null
  isPrimary?: boolean
  isActive?: boolean
  openingIntervals: OpeningIntervalInput[]
}

export type SiteWithOpeningHours = LudoSiteRow & {
  openingIntervals: SiteOpeningIntervalRow[]
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function required(value: string, label: string, max: number): string {
  const result = value.trim()
  if (!result) throw new SiteServiceError(`${label} est requis.`)
  if (result.length > max) throw new SiteServiceError(`${label} est trop long (${max} max).`)
  return result
}

function optional(value: string | null | undefined, max: number, label: string): string | null {
  const result = value?.trim() || null
  if (result && result.length > max) {
    throw new SiteServiceError(`${label} est trop long (${max} max).`)
  }
  return result
}

function normalizeSlug(value: string): string {
  const slug = required(value, 'Le slug', 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (!slug) throw new SiteServiceError('Le slug est invalide.')
  return slug
}

function normalizeCoordinates(latitude?: number | null, longitude?: number | null) {
  const lat = latitude ?? null
  const lng = longitude ?? null
  if ((lat == null) !== (lng == null)) {
    throw new SiteServiceError('La latitude et la longitude doivent être renseignées ensemble.')
  }
  if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    throw new SiteServiceError('La latitude est invalide.')
  }
  if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
    throw new SiteServiceError('La longitude est invalide.')
  }
  return { latitude: lat, longitude: lng }
}

export function normalizeOpeningIntervals(
  intervals: OpeningIntervalInput[],
): Array<OpeningIntervalInput & { sortOrder: number }> {
  const normalized = intervals.map((interval, index) => {
    if (!Number.isInteger(interval.dayOfWeek) || interval.dayOfWeek < 1 || interval.dayOfWeek > 7) {
      throw new SiteServiceError('Le jour doit être compris entre 1 (lundi) et 7 (dimanche).')
    }
    const opensAt = interval.opensAt.trim()
    const closesAt = interval.closesAt.trim()
    if (!TIME_PATTERN.test(opensAt) || !TIME_PATTERN.test(closesAt) || opensAt >= closesAt) {
      throw new SiteServiceError("L'intervalle horaire est invalide.")
    }
    return { dayOfWeek: interval.dayOfWeek, opensAt, closesAt, sortOrder: index }
  })

  normalized.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.opensAt.localeCompare(b.opensAt))
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1]
    const current = normalized[index]
    if (previous.dayOfWeek === current.dayOfWeek && current.opensAt < previous.closesAt) {
      throw new SiteServiceError("Deux horaires d'ouverture se chevauchent le même jour.")
    }
  }
  return normalized.map((interval, sortOrder) => ({ ...interval, sortOrder }))
}

function normalizeSite(input: SiteInput) {
  return {
    slug: normalizeSlug(input.slug),
    name: required(input.name, 'Le nom', 120),
    address: optional(input.address, 240, "L'adresse"),
    postalCode: optional(input.postalCode, 20, 'Le code postal'),
    city: optional(input.city, 120, 'La ville'),
    phone: optional(input.phone, 40, 'Le téléphone'),
    email: optional(input.email, 200, "L'adresse e-mail"),
    accessInfo: optional(input.accessInfo, 1000, "Les informations d'accès"),
    ...normalizeCoordinates(input.latitude, input.longitude),
    isActive: input.isActive,
    isPrimary: input.isPrimary,
    openingIntervals: normalizeOpeningIntervals(input.openingIntervals),
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

export async function listSitesWithOpeningHours(ludoId: string): Promise<SiteWithOpeningHours[]> {
  return listSiteRowsWithOpeningHours(ludoId)
}

export async function listActiveSitesByLudo(ludoId: string): Promise<LudoSiteRow[]> {
  return listActiveSiteRows(ludoId)
}

export async function getSiteByIdForLudo(
  siteId: string,
  ludoId: string,
): Promise<SiteWithOpeningHours | undefined> {
  return getSiteRowForLudo(siteId, ludoId)
}

export async function createSiteWithOpeningHours(
  ludoId: string,
  input: SiteInput,
): Promise<SiteWithOpeningHours> {
  const fields = normalizeSite(input)
  const [existing, activeSites] = await Promise.all([
    listSiteRowsWithOpeningHours(ludoId),
    listActiveSiteRows(ludoId),
  ])
  const isActive = fields.isActive ?? true
  const isPrimary = activeSites.length === 0 ? true : (fields.isPrimary ?? false)
  if (!isActive && isPrimary) {
    throw new SiteServiceError('Le lieu principal doit être actif.')
  }
  try {
    const { openingIntervals, ...siteFields } = fields
    const id = randomUUID()
    const maxSortOrder = existing.reduce((max, site) => Math.max(max, site.sortOrder), -1)
    await insertSiteWithIntervalsAtomic(
      {
        id,
        ludoId,
        ...siteFields,
        isActive,
        isPrimary,
        sortOrder: maxSortOrder + 1,
      },
      openingIntervals,
      isPrimary,
    )
    return (await getSiteRowForLudo(id, ludoId))!
  } catch (error) {
    if (isUniqueViolation(error)) throw new SiteServiceError('Un lieu avec ce slug existe déjà.')
    throw error
  }
}

export async function updateSiteWithOpeningHours(
  ludoId: string,
  siteId: string,
  input: SiteInput,
): Promise<SiteWithOpeningHours> {
  const current = await getSiteRowForLudo(siteId, ludoId)
  if (!current) throw new SiteServiceError('Lieu introuvable.')
  const fields = normalizeSite(input)
  if (fields.slug !== current.slug) {
    throw new SiteServiceError(
      'Le slug du lieu ne peut pas être modifié pendant la migration des fréquentations.',
    )
  }
  const isPrimary = fields.isPrimary ?? current.isPrimary
  const isActive = fields.isActive ?? current.isActive
  if (current.isPrimary && (!isPrimary || !isActive)) {
    throw new SiteServiceError("Choisissez d'abord un autre lieu principal actif.")
  }
  if (isPrimary && !isActive) {
    throw new SiteServiceError('Le lieu principal doit être actif.')
  }
  try {
    await updateSiteWithIntervalsAtomic(
      siteId,
      ludoId,
      {
        name: fields.name,
        address: fields.address,
        postalCode: fields.postalCode,
        city: fields.city,
        phone: fields.phone,
        email: fields.email,
        accessInfo: fields.accessInfo,
        latitude: fields.latitude,
        longitude: fields.longitude,
        isActive,
      },
      fields.openingIntervals,
      isPrimary,
    )
    return (await getSiteRowForLudo(siteId, ludoId))!
  } catch (error) {
    if (isUniqueViolation(error)) throw new SiteServiceError('Un lieu avec ce slug existe déjà.')
    throw error
  }
}

export async function reorderSites(ludoId: string, orderedIds: string[]): Promise<void> {
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new SiteServiceError('La liste des lieux contient un doublon.')
  }
  const sites = await listSiteRowsWithOpeningHours(ludoId)
  if (sites.length !== orderedIds.length || sites.some((site) => !orderedIds.includes(site.id))) {
    throw new SiteServiceError('La liste des lieux ne correspond pas à cet espace.')
  }
  await updateSiteOrderRows(ludoId, orderedIds)
}
