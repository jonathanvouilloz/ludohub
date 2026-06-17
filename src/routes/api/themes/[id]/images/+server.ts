import { error, json } from '@sveltejs/kit'
import { del, put } from '@vercel/blob'
import { env } from '$env/dynamic/private'
import { requireSessionContext } from '$lib/server/ludo-context.js'
import {
  getImageForDeletion,
  registerImage,
  setCover,
  ThemeServiceError,
  unregisterImage,
} from '$lib/server/services/themes.js'
import type { RequestHandler } from './$types'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

function blobToken(): string {
  const token = env.BLOB_READ_WRITE_TOKEN
  if (!token) throw error(500, 'Stockage des images non configuré.')
  return token
}

// Upload d'une photo de thème vers Vercel Blob + enregistrement DB.
export const POST: RequestHandler = async (event) => {
  const { ludo } = await requireSessionContext(event)
  const themeId = event.params.id as string

  const form = await event.request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    throw error(400, 'Aucun fichier fourni.')
  }
  // Validation MIME côté serveur (pas seulement l'extension) + taille.
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) throw error(415, 'Format non supporté (jpg, png ou webp uniquement).')
  if (file.size > MAX_SIZE) throw error(413, 'Image trop lourde (5 Mo maximum).')

  const storageKey = `themes/${themeId}/${crypto.randomUUID()}.${ext}`

  try {
    const blob = await put(storageKey, file, {
      access: 'public',
      contentType: file.type,
      token: blobToken(),
    })
    const image = await registerImage(themeId, ludo.id, blob.url, blob.pathname)
    return json(image, { status: 201 })
  } catch (err) {
    if (err instanceof ThemeServiceError) throw error(400, err.message)
    throw err
  }
}

// Définition de la photo de couverture. `imageId` en query string.
export const PATCH: RequestHandler = async (event) => {
  const { ludo } = await requireSessionContext(event)
  const imageId = event.url.searchParams.get('imageId')
  if (!imageId) throw error(400, 'Identifiant de photo manquant.')

  try {
    await setCover(imageId, ludo.id)
    return json({ ok: true })
  } catch (err) {
    if (err instanceof ThemeServiceError) throw error(400, err.message)
    throw err
  }
}

// Suppression d'une photo (Blob + DB). `imageId` en query string.
export const DELETE: RequestHandler = async (event) => {
  const { ludo } = await requireSessionContext(event)
  const imageId = event.url.searchParams.get('imageId')
  if (!imageId) throw error(400, 'Identifiant de photo manquant.')

  try {
    const image = await getImageForDeletion(imageId, ludo.id)
    await del(image.storageKey, { token: blobToken() })
    await unregisterImage(image)
    return json({ ok: true })
  } catch (err) {
    if (err instanceof ThemeServiceError) throw error(400, err.message)
    throw err
  }
}
