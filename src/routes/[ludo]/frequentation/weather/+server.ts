import { json } from '@sveltejs/kit'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { fetchWeather } from '$lib/server/weather.js'
import type { RequestHandler } from './$types'

const PERIODS = ['matin', 'apres_midi', 'evenement'] as const

/**
 * Pré-remplissage météo pour le dialog de clôture.
 * `GET ?date=YYYY-MM-DD&period=matin` → `{ condition, temperature }` ou `null`.
 */
export const GET: RequestHandler = async (event) => {
  await requireLudoContext(event)
  const date = event.url.searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(null)
  }
  const raw = event.url.searchParams.get('period') ?? 'matin'
  const period = (PERIODS as readonly string[]).includes(raw)
    ? (raw as (typeof PERIODS)[number])
    : 'matin'
  return json(await fetchWeather(date, period))
}
