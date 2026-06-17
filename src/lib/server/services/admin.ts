import { hashLudoPassword } from './auth.js'
import { normalizeSlug } from '$lib/utils/slug.js'
import {
  createLudo,
  getAllLudos,
  getLudoById,
  getLudoBySlug,
  updateLudoById,
} from '../db/ludotheques.js'
import { getGlobalActivityLog as dbGetGlobalActivityLog } from '../db/activity_log.js'
import type { ActivityLogRow, LudothequeRow } from '../schema.js'

/** Erreur métier (message destiné à l'UI admin). */
export class AdminServiceError extends Error {}

// ─── Parsing / validation ──────────────────────────────────────────────────────

function parseLudoName(value: string): string {
  const name = value.trim()
  if (!name) throw new AdminServiceError('Le nom de la ludothèque est requis.')
  return name
}

function parseColor(value: string): string {
  const color = value.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new AdminServiceError('Couleur invalide (format attendu : #RRGGBB).')
  }
  return color.toLowerCase()
}

function parseSlug(value: string): string {
  const slug = normalizeSlug(value)
  if (!slug) throw new AdminServiceError('Le slug est requis (lettres ou chiffres).')
  return slug
}

function parseNewPassword(value: string): string {
  if (value.length < 6) {
    throw new AdminServiceError('Le mot de passe doit faire au moins 6 caractères.')
  }
  return value
}

function parseAddress(value: string | undefined): string | null {
  const address = value?.trim()
  return address ? address : null
}

// ─── Ludothèques ────────────────────────────────────────────────────────────────

export async function createLudotheque(data: {
  name: string
  slug?: string
  color: string
  password: string
  address?: string
}): Promise<LudothequeRow> {
  const name = parseLudoName(data.name)
  // Slug fourni explicitement, sinon dérivé du nom.
  const slug = parseSlug(data.slug?.trim() ? data.slug : name)
  const color = parseColor(data.color)
  const password = parseNewPassword(data.password)

  const existing = await getLudoBySlug(slug)
  if (existing) throw new AdminServiceError(`Le slug « ${slug} » est déjà utilisé.`)

  const passwordHash = await hashLudoPassword(password)
  return createLudo({ name, slug, color, passwordHash, address: parseAddress(data.address) })
}

export async function updateLudotheque(
  id: string,
  data: { name?: string; color?: string; address?: string },
): Promise<LudothequeRow> {
  await requireLudo(id)

  // Le slug n'est pas modifiable après création (URLs + sessions en dépendent).
  const patch: Partial<{ name: string; color: string; address: string | null }> = {}
  if (data.name !== undefined) patch.name = parseLudoName(data.name)
  if (data.color !== undefined) patch.color = parseColor(data.color)
  if (data.address !== undefined) patch.address = parseAddress(data.address)

  return updateLudoById(id, patch)
}

export async function resetLudoPassword(id: string, newPassword: string): Promise<void> {
  await requireLudo(id)
  const passwordHash = await hashLudoPassword(parseNewPassword(newPassword))
  await updateLudoById(id, { passwordHash })
}

// ─── Lectures ────────────────────────────────────────────────────────────────

export function listLudotheques(): Promise<LudothequeRow[]> {
  return getAllLudos()
}

export async function getLudotheque(id: string): Promise<LudothequeRow> {
  return requireLudo(id)
}

export function getGlobalActivityLog(
  opts: { limit?: number; ludoId?: string; action?: string } = {},
): Promise<ActivityLogRow[]> {
  return dbGetGlobalActivityLog(opts)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireLudo(id: string): Promise<LudothequeRow> {
  const ludo = await getLudoById(id)
  if (!ludo) throw new AdminServiceError('Ludothèque introuvable.')
  return ludo
}
