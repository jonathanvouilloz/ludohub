import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getAllLudos } from '$lib/server/db/ludotheques.js'
import {
  extensionError,
  extensionHeaders,
  requireExtensionPrincipal,
} from '$lib/server/extension-http.js'

function publicDetail(value: string | null, max: number) {
  if (!value) return null
  const clean = value.trim()
  if (!clean || clean.length > max) return null
  return clean
}

export const OPTIONS: RequestHandler = ({ request }) => {
  const headers = extensionHeaders(request, 'GET')
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 })
}

export const GET: RequestHandler = async ({ request }) => {
  const headers = extensionHeaders(request, 'GET')
  if (!headers) return json({ error: 'origin_not_allowed' }, { status: 403 })
  try {
    await requireExtensionPrincipal(request)
    const ludos = await getAllLudos()
    return json(
      {
        ludos: ludos.map((ludo) => ({
          slug: ludo.slug,
          name: ludo.name,
          logoUrl: ludo.logoUrl && /^https:\/\/\S+$/.test(ludo.logoUrl) ? ludo.logoUrl : null,
          address: publicDetail(ludo.address, 300),
          phone: publicDetail(ludo.phone, 50),
          email: publicDetail(ludo.email, 320),
          website: publicDetail(ludo.website, 300),
        })),
      },
      { headers },
    )
  } catch (error) {
    return extensionError(error, headers)
  }
}
