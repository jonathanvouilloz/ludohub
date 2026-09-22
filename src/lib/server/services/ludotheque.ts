import { updateLudoById } from '../db/ludotheques.js'
import type { LudothequeRow } from '../schema.js'
import { hashLudoPassword } from './auth.js'
import { verifyPassword } from 'better-auth/crypto'

/** Erreur métier (message destiné à l'UI responsable). */
export class LudothequeServiceError extends Error {}

// ─── Parsing / validation ──────────────────────────────────────────────────────

function parseName(value: string): string {
  const name = value.trim()
  if (!name) throw new LudothequeServiceError('Le nom de la ludothèque est requis.')
  return name
}

function parseColor(value: string): string {
  const color = value.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new LudothequeServiceError('Couleur invalide (format attendu : #RRGGBB).')
  }
  return color.toLowerCase()
}

/** Champ texte optionnel : '' → null. */
function parseOptional(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

function parseEmail(value: string | undefined): string | null {
  const email = parseOptional(value)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new LudothequeServiceError('Adresse email invalide.')
  }
  return email
}

/** Normalise un site web : ajoute https:// si le schéma manque. */
function parseWebsite(value: string | undefined): string | null {
  const raw = parseOptional(value)
  if (!raw) return null
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    new URL(url)
  } catch {
    throw new LudothequeServiceError('Adresse du site web invalide.')
  }
  return url
}

function parsePassword(value: string): string {
  if (value.length < 6) {
    throw new LudothequeServiceError('Le mot de passe doit faire au moins 6 caractères.')
  }
  if (value.length > 200) throw new LudothequeServiceError('Le mot de passe est trop long.')
  return value
}

// ─── Mutations ──────────────────────────────────────────────────────────────────

export interface LudoInfoInput {
  name: string
  color: string
  responsible?: string
  address?: string
  phone?: string
  email?: string
  website?: string
}

/**
 * Met à jour les informations publiques d'une ludothèque (côté responsable).
 * Le slug reste réservé au super-admin.
 */
export async function updateLudoInfo(ludoId: string, data: LudoInfoInput): Promise<LudothequeRow> {
  return updateLudoById(ludoId, {
    name: parseName(data.name),
    color: parseColor(data.color),
    responsible: parseOptional(data.responsible),
    address: parseOptional(data.address),
    phone: parseOptional(data.phone),
    email: parseEmail(data.email),
    website: parseWebsite(data.website),
  })
}

/** Un responsable change le mot de passe partagé de sa propre ludothèque. */
export async function changeLudoPassword(
  ludo: Pick<LudothequeRow, 'id' | 'passwordHash'>,
  currentPassword: string,
  nextPassword: string,
): Promise<LudothequeRow> {
  const valid = await verifyPassword({ hash: ludo.passwordHash, password: currentPassword })
  if (!valid) throw new LudothequeServiceError('Le mot de passe actuel est incorrect.')
  return updateLudoById(ludo.id, {
    passwordHash: await hashLudoPassword(parsePassword(nextPassword)),
  })
}

/**
 * Met à jour l'URL du logo (Blob) d'une ludothèque. `null` = retrait du logo.
 * L'upload/suppression du fichier Blob est orchestré côté route (cf. pattern thèmes).
 */
export async function setLudoLogo(ludoId: string, logoUrl: string | null): Promise<LudothequeRow> {
  return updateLudoById(ludoId, { logoUrl })
}
