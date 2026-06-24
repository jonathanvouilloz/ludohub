import { fail } from '@sveltejs/kit'
import {
  AttendanceServiceError,
  deleteSession,
  listSessionsInRange,
  recordSession,
  updateSession,
  type SessionInput,
} from '$lib/server/services/attendance.js'
import { getActiveSeasonByLudo, getSeasonsByLudo } from '$lib/server/db/planning.js'
import { listTypes } from '$lib/server/services/eventTypes.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent, url }) => {
  const { ludo } = await parent()
  const [seasons, eventTypes] = await Promise.all([getSeasonsByLudo(ludo.id), listTypes(ludo.id)])

  // Saison sélectionnée : param `?season=<id>` sinon saison active.
  const paramId = url.searchParams.get('season')
  let season = paramId ? (seasons.find((s) => s.id === paramId) ?? null) : null
  if (!season) season = (await getActiveSeasonByLudo(ludo.id)) ?? null

  // Plage chargée : la saison, sinon repli sur l'année civile courante.
  let start: string
  let end: string
  let fallbackYear: number | null = null
  if (season) {
    start = season.startDate
    end = season.endDate
  } else {
    fallbackYear = new Date().getFullYear()
    start = `${fallbackYear}-01-01`
    end = `${fallbackYear}-12-31`
  }

  const records = await listSessionsInRange(ludo.id, start, end)
  return {
    records,
    eventTypes: eventTypes.map((t) => ({ id: t.id, name: t.name })),
    seasons: seasons.map((s) => ({ id: s.id, name: s.name })),
    season: season
      ? { id: season.id, name: season.name, startDate: season.startDate, endDate: season.endDate }
      : null,
    fallbackYear,
  }
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { success: true }
  } catch (err) {
    if (err instanceof AttendanceServiceError) return fail(400, { error: err.message })
    throw err
  }
}

/** Lit les champs de séance d'un FormData (compteurs → entiers, météo/temp nullable). */
function parseSessionInput(data: FormData): SessionInput {
  const num = (key: string) => {
    const raw = String(data.get(key) ?? '').trim()
    return raw === '' ? 0 : Number(raw)
  }
  const temp = String(data.get('temperature') ?? '').trim()
  const weather = String(data.get('weather') ?? '').trim()
  return {
    date: String(data.get('date') ?? ''),
    period: String(data.get('period') ?? ''),
    eventLabel: String(data.get('eventLabel') ?? ''),
    eventTypeId: String(data.get('eventTypeId') ?? '') || null,
    adultsCount: num('adultsCount'),
    childrenCount: num('childrenCount'),
    loansCount: num('loansCount'),
    returnsCount: num('returnsCount'),
    weather: weather === '' ? null : weather,
    temperature: temp === '' ? null : Number(temp),
  }
}

export const actions: Actions = {
  record: async (event) => {
    const { ludo, member } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => recordSession(ludo.id, member.id, parseSessionInput(data)))
  },

  update: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => updateSession(String(data.get('id') ?? ''), ludo.id, parseSessionInput(data)))
  },

  delete: async (event) => {
    const { ludo } = await requireLudoContext(event)
    const data = await event.request.formData()
    return run(() => deleteSession(String(data.get('id') ?? ''), ludo.id))
  },
}
