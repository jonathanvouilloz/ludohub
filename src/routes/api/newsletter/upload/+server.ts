import { error, json } from '@sveltejs/kit'
import { put } from '@vercel/blob'
import { env } from '$env/dynamic/private'
import { requireSessionContext } from '$lib/server/ludo-context.js'
import type { RequestHandler } from './$types'

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_IMAGE = 5 * 1024 * 1024 // 5 MB
const MAX_PDF = 10 * 1024 * 1024 // 10 MB

function blobToken(): string {
  const token = env.BLOB_READ_WRITE_TOKEN
  if (!token) throw error(500, 'Stockage des fichiers non configuré.')
  return token
}

/** Upload d'une image ou d'un PDF de campagne vers Vercel Blob. `?kind=image|pdf`. */
export const POST: RequestHandler = async (event) => {
  const { ludo } = await requireSessionContext(event)
  const kind = event.url.searchParams.get('kind') === 'pdf' ? 'pdf' : 'image'

  const form = await event.request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) throw error(400, 'Aucun fichier fourni.')

  let ext: string
  if (kind === 'pdf') {
    if (file.type !== 'application/pdf') throw error(415, 'Le document doit être un PDF.')
    if (file.size > MAX_PDF) throw error(413, 'PDF trop lourd (10 Mo maximum).')
    ext = 'pdf'
  } else {
    const mapped = IMAGE_TYPES[file.type]
    if (!mapped) throw error(415, 'Format non supporté (jpg, png ou webp).')
    if (file.size > MAX_IMAGE) throw error(413, 'Image trop lourde (5 Mo maximum).')
    ext = mapped
  }

  const blob = await put(`newsletters/${ludo.id}/${kind}-${crypto.randomUUID()}.${ext}`, file, {
    access: 'public',
    contentType: file.type,
    token: blobToken(),
  })
  return json({ url: blob.url })
}
