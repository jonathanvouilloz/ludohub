import {
  addThemeImage,
  addThemeItem,
  countThemeImages,
  createTheme,
  deleteThemeImage,
  deleteThemeItem,
  getShareableThemes,
  getThemeById,
  getThemeImageById,
  getThemeItemById,
  getThemesByLudo,
  updateTheme,
} from '../db/themes.js'
import type { ThemeImageRow, ThemeItemRow, ThemeRow } from '../schema.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class ThemeServiceError extends Error {}

const MAX_IMAGES = 3

function parseName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new ThemeServiceError('Le nom est requis.')
  if (trimmed.length > 120) throw new ThemeServiceError('Le nom est trop long (120 max).')
  return trimmed
}

function parseQuantity(value: string): number {
  const n = Number.parseInt(value, 10)
  if (!Number.isInteger(n) || n < 1) {
    throw new ThemeServiceError('La quantité doit être un entier ≥ 1.')
  }
  return n
}

/** Charge un thème et vérifie qu'il appartient bien à la ludo. */
async function requireThemeInLudo(id: string, ludoId: string) {
  const theme = await getThemeById(id)
  if (!theme || theme.ownerLudoId !== ludoId) {
    throw new ThemeServiceError('Thème introuvable.')
  }
  return theme
}

/** Charge un thème modifiable (existe, appartient à la ludo, non archivé). */
async function requireWritableTheme(id: string, ludoId: string) {
  const theme = await requireThemeInLudo(id, ludoId)
  if (theme.isArchived) {
    throw new ThemeServiceError('Ce thème est archivé et ne peut pas être modifié.')
  }
  return theme
}

// ─── CRUD thème ──────────────────────────────────────────────────────────────

export async function createThemeForLudo(
  ludoId: string,
  data: { name: string; description?: string; isShareable?: boolean },
  items: Array<{ name: string; quantity: string }> = [],
): Promise<ThemeRow> {
  const name = parseName(data.name)
  const parsedItems = items
    .filter((i) => i.name.trim())
    .map((i) => ({ name: parseName(i.name), quantity: parseQuantity(i.quantity) }))

  const theme = await createTheme({
    ownerLudoId: ludoId,
    name,
    description: data.description?.trim() || null,
    isShareable: data.isShareable ?? false,
  })

  for (const item of parsedItems) {
    await addThemeItem({ themeId: theme.id, name: item.name, quantity: item.quantity })
  }

  return theme
}

export async function editTheme(
  id: string,
  ludoId: string,
  data: { name: string; description?: string },
): Promise<ThemeRow> {
  await requireWritableTheme(id, ludoId)
  return updateTheme(id, {
    name: parseName(data.name),
    description: data.description?.trim() || null,
  })
}

export async function setThemeShareable(
  id: string,
  ludoId: string,
  shareable: boolean,
): Promise<ThemeRow> {
  await requireWritableTheme(id, ludoId)
  return updateTheme(id, { isShareable: shareable })
}

export async function archiveTheme(
  id: string,
  ludoId: string,
  archived: boolean,
): Promise<ThemeRow> {
  await requireThemeInLudo(id, ludoId)
  return updateTheme(id, { isArchived: archived })
}

// ─── Items ─────────────────────────────────────────────────────────────────

export async function addItem(
  themeId: string,
  ludoId: string,
  data: { name: string; quantity: string },
): Promise<ThemeItemRow> {
  await requireWritableTheme(themeId, ludoId)
  return addThemeItem({
    themeId,
    name: parseName(data.name),
    quantity: parseQuantity(data.quantity),
  })
}

export async function removeItem(itemId: string, ludoId: string): Promise<void> {
  const item = await getThemeItemById(itemId)
  if (!item) throw new ThemeServiceError('Item introuvable.')
  await requireWritableTheme(item.themeId, ludoId)
  await deleteThemeItem(itemId)
}

// ─── Images ────────────────────────────────────────────────────────────────

/**
 * Enregistre en DB une image déjà uploadée sur Vercel Blob. Vérifie la limite
 * (max 3) et l'appartenance du thème à la ludo. L'upload Blob lui-même est fait
 * par l'endpoint `/api/themes/[id]/images`.
 */
export async function registerImage(
  themeId: string,
  ludoId: string,
  url: string,
  storageKey: string,
): Promise<ThemeImageRow> {
  await requireWritableTheme(themeId, ludoId)
  const count = await countThemeImages(themeId)
  if (count >= MAX_IMAGES) {
    throw new ThemeServiceError(`Maximum ${MAX_IMAGES} photos par thème.`)
  }
  return addThemeImage({ themeId, url, storageKey })
}

/** Vérifie l'appartenance puis renvoie l'image (pour suppression Blob + DB). */
export async function getImageForDeletion(imageId: string, ludoId: string): Promise<ThemeImageRow> {
  const image = await getThemeImageById(imageId)
  if (!image) throw new ThemeServiceError('Photo introuvable.')
  await requireThemeInLudo(image.themeId, ludoId)
  return image
}

export async function unregisterImage(imageId: string): Promise<void> {
  await deleteThemeImage(imageId)
}

// ─── Lectures ────────────────────────────────────────────────────────────────

export async function listThemes(ludoId: string) {
  return getThemesByLudo(ludoId)
}

export async function getThemeDetail(id: string, ludoId: string) {
  return requireThemeInLudo(id, ludoId)
}

/** Catalogue réseau : thèmes partageables des autres ludos (lecture seule). */
export async function getNetworkThemes(excludeLudoId: string) {
  return getShareableThemes(excludeLudoId)
}
