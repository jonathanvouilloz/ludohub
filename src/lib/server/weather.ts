import type { AttendancePeriod, WeatherCondition } from './schema.js'

// Coordonnées de Genève, codées en dur en V1 (toutes les ludos FASE sont à Genève).
// Affinage par ludo = V2.
const GENEVA_LAT = 46.2044
const GENEVA_LON = 6.1432
const TIMEZONE = 'Europe/Zurich'
const FETCH_TIMEOUT_MS = 3000

// Heure représentative de chaque créneau, pour piocher la météo horaire.
const PERIOD_HOUR: Record<AttendancePeriod, number> = {
  matin: 10,
  apres_midi: 15,
  evenement: 18,
}

/**
 * Mappe un code météo WMO (Open-Meteo) vers une de nos 4 conditions.
 * Exporté séparément pour pouvoir le tester unitairement.
 */
export function mapWmoToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return 'beau'
  if (code >= 71 && code <= 77) return 'neige'
  if (code === 85 || code === 86) return 'neige'
  if (code >= 51 && code <= 67) return 'pluie'
  if (code >= 80 && code <= 82) return 'pluie'
  if (code >= 95 && code <= 99) return 'pluie' // orage assimilé à pluie
  // 2–3 (nuageux/couvert) et 45/48 (brouillard) → gris ; défaut prudent : gris.
  return 'gris'
}

export type WeatherResult = { condition: WeatherCondition; temperature: number }

/**
 * Récupère la météo de Genève pour une date `YYYY-MM-DD` et une période via
 * Open-Meteo (forecast pour aujourd'hui/futur, archive pour le passé). Pas de clé.
 *
 * Données **horaires** : on pioche l'heure représentative du créneau
 * (matin → 10h, après-midi → 15h, événement → 18h) pour refléter la météo réelle
 * du moment plutôt que l'agrégat du jour.
 *
 * Jamais bloquant : en cas d'échec (réseau, timeout, format inattendu),
 * renvoie `null` → le dialog s'ouvre avec des champs vides (saisie manuelle).
 */
export async function fetchWeather(
  date: string,
  period: AttendancePeriod = 'matin',
): Promise<WeatherResult | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  // L'API `forecast` couvre ~92 jours passés + le futur proche ; l'API `archive`
  // (ERA5) a ~5 jours de latence. On privilégie donc `forecast` pour aujourd'hui et
  // les corrections récentes (cas d'usage principal), `archive` seulement au-delà.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
  const base =
    date < ninetyDaysAgo
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast'

  const hour = PERIOD_HOUR[period] ?? 12
  const url =
    `${base}?latitude=${GENEVA_LAT}&longitude=${GENEVA_LON}` +
    `&hourly=weather_code,temperature_2m&timezone=${encodeURIComponent(TIMEZONE)}` +
    `&start_date=${date}&end_date=${date}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const json = (await res.json()) as {
      hourly?: {
        time?: string[]
        weather_code?: (number | null)[]
        temperature_2m?: (number | null)[]
      }
    }
    const times = json.hourly?.time
    const codes = json.hourly?.weather_code
    const temps = json.hourly?.temperature_2m
    if (!times || !codes || !temps) return null

    // Index de l'heure cible (`…T15:00`) ; repli sur l'index brut si introuvable.
    const hh = String(hour).padStart(2, '0')
    let idx = times.findIndex((t) => t.endsWith(`T${hh}:00`))
    if (idx === -1) idx = Math.min(hour, times.length - 1)

    const code = codes[idx]
    const temp = temps[idx]
    if (code == null || temp == null) return null
    return { condition: mapWmoToCondition(code), temperature: Math.round(temp) }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
