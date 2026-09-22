import { fail } from '@sveltejs/kit'
import { del, put } from '@vercel/blob'
import { env } from '$env/dynamic/private'
import {
  changeLudoPassword,
  LudothequeServiceError,
  setLudoLogo,
  updateLudoInfo,
} from '$lib/server/services/ludotheque.js'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import { setLudoSessionCookie } from '$lib/server/services/auth.js'
import type { Actions, PageServerLoad } from './$types'

const LOGO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}
const LOGO_MAX_SIZE = 2 * 1024 * 1024 // 2 MB

function blobToken(): string {
  const token = env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new LudothequeServiceError('Stockage des images non configuré.')
  return token
}

export const load: PageServerLoad = async (event) => {
  const { ludo } = await requireResponsableContext(event)
  return { ludo }
}

export const actions: Actions = {
  update: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    try {
      await updateLudoInfo(ludo.id, {
        name: String(data.get('name') ?? ''),
        color: String(data.get('color') ?? ''),
        responsible: String(data.get('responsible') ?? ''),
        address: String(data.get('address') ?? ''),
        phone: String(data.get('phone') ?? ''),
        email: String(data.get('email') ?? ''),
        website: String(data.get('website') ?? ''),
      })
      return { success: true }
    } catch (err) {
      if (err instanceof LudothequeServiceError) return fail(400, { error: err.message })
      throw err
    }
  },

  changePassword: async (event) => {
    const { ludo, member } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const nextPassword = String(data.get('nextPassword') ?? '')
    if (nextPassword !== String(data.get('confirmPassword') ?? ''))
      return fail(400, { passwordError: 'Les deux nouveaux mots de passe ne correspondent pas.' })
    try {
      const updated = await changeLudoPassword(
        ludo,
        String(data.get('currentPassword') ?? ''),
        nextPassword,
      )
      await setLudoSessionCookie(event.cookies, { ludoId: ludo.id, memberId: member.id }, updated.passwordHash)
      return { passwordSuccess: true }
    } catch (err) {
      if (err instanceof LudothequeServiceError) return fail(400, { passwordError: err.message })
      throw err
    }
  },

  uploadLogo: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    const data = await event.request.formData()
    const file = data.get('logo')
    try {
      if (!(file instanceof File) || file.size === 0) {
        throw new LudothequeServiceError('Aucun fichier fourni.')
      }
      const ext = LOGO_TYPES[file.type]
      if (!ext) throw new LudothequeServiceError('Format non supporté (jpg, png, webp ou svg).')
      if (file.size > LOGO_MAX_SIZE) throw new LudothequeServiceError('Logo trop lourd (2 Mo max).')

      const blob = await put(`ludos/${ludo.id}/logo-${crypto.randomUUID()}.${ext}`, file, {
        access: 'public',
        contentType: file.type,
        token: blobToken(),
      })
      // Retrait best-effort de l'ancien logo (Blob accepte l'URL complète).
      if (ludo.logoUrl) await del(ludo.logoUrl, { token: blobToken() }).catch(() => {})
      await setLudoLogo(ludo.id, blob.url)
      return { success: true }
    } catch (err) {
      if (err instanceof LudothequeServiceError) return fail(400, { error: err.message })
      throw err
    }
  },

  removeLogo: async (event) => {
    const { ludo } = await requireResponsableContext(event)
    if (ludo.logoUrl) await del(ludo.logoUrl, { token: blobToken() }).catch(() => {})
    await setLudoLogo(ludo.id, null)
    return { success: true }
  },
}
