import { error, json } from '@sveltejs/kit'
import { requireSessionContext } from '$lib/server/ludo-context.js'
import {
  importContacts,
  NewsletterServiceError,
  parseContactsFile,
  type ImportMapping,
} from '$lib/server/services/newsletter.js'
import type { RequestHandler } from './$types'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * Import de contacts en deux temps :
 *  - `?step=parse`  (multipart) : upload fichier → { headers, rows } (aucune écriture)
 *  - `?step=commit` (JSON)      : { mapping, rows } → insertion + compte-rendu
 * Auth : contexte tenant résolu depuis la session (route sans param `[ludo]`).
 */
export const POST: RequestHandler = async (event) => {
  const { ludo } = await requireSessionContext(event)
  const step = event.url.searchParams.get('step') ?? 'parse'

  try {
    if (step === 'commit') {
      const body = (await event.request.json()) as {
        mapping: ImportMapping
        rows: string[][]
        tag?: string
      }
      const result = await importContacts(ludo.id, body.mapping, body.rows, body.tag)
      return json(result)
    }

    const form = await event.request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) throw error(400, 'Aucun fichier fourni.')
    if (file.size > MAX_SIZE) throw error(413, 'Fichier trop lourd (5 Mo maximum).')

    const parsed = await parseContactsFile(file)
    return json(parsed)
  } catch (err) {
    if (err instanceof NewsletterServiceError) throw error(400, err.message)
    throw err
  }
}
