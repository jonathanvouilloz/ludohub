/**
 * Parsing des vacances scolaires genevoises depuis la page officielle ge.ch.
 *
 * Structure HTML de la source :
 *   <p>
 *     <strong>Vacances d'automne</strong><br>
 *     du&nbsp;&nbsp;
 *     <span class="document tag">
 *       <a href="/document/38179/telecharger"
 *          title="lundi 19 octobre 2026 au vendredi 23 octobre 2026">
 *         lundi 19 octobre 2026...<span class="material-icons-outlined">calendar_month</span>
 *       </a>
 *     </span>
 *   </p>
 *
 * Stratégie : cibler les <a href="/document/ID/telecharger"> et lire leur attribut title="..."
 * (contient le texte de date propre, sans HTML imbriqué).
 * Chercher en arrière le <strong> précédent le plus proche pour le label.
 *
 * Trois patterns de dates dans title :
 *   1. Plage     : "[n] [mois] [yyyy] au [n] [mois] [yyyy]"
 *   2. Multi-jour: "[n] [mois] [yyyy] et [n] [mois] [yyyy]"
 *   3. Jour seul : "[n] [mois] [yyyy]"
 *
 * Lignes ignorées : contenant "dès le" (= rentrée scolaire, pas une fermeture).
 */

export type GEPeriod = { label: string; startDate: string; endDate: string }

const MONTHS: Record<string, number> = {
  janvier: 1,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
}

const MONTH_PATTERN = Object.keys(MONTHS).join('|')
const DAY_PATTERN = 'lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche'

function frDateToISO(day: string, month: string, year: string): string {
  const m = MONTHS[month.toLowerCase()]
  if (!m) return ''
  return `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseFrenchDates(text: string): { startDate: string; endDate: string } {
  // Pattern 1 — plage : "[day] [n] [mois] [yyyy] au [day] [n] [mois] [yyyy]"
  const rangeRx = new RegExp(
    `(?:${DAY_PATTERN})?\\s*(\\d+)\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\s+au\\s+(?:${DAY_PATTERN})?\\s*(\\d+)\\s+(${MONTH_PATTERN})\\s+(\\d{4})`,
    'i',
  )
  const rangeM = text.match(rangeRx)
  if (rangeM) {
    return {
      startDate: frDateToISO(rangeM[1], rangeM[2], rangeM[3]),
      endDate: frDateToISO(rangeM[4], rangeM[5], rangeM[6]),
    }
  }

  // Pattern 2 — multi-jours : "[day] [n] [mois] [yyyy] et [day] [n] [mois] [yyyy]"
  const multiRx = new RegExp(
    `(?:${DAY_PATTERN})?\\s*(\\d+)\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\s+et\\s+(?:${DAY_PATTERN})?\\s*(\\d+)\\s+(${MONTH_PATTERN})\\s+(\\d{4})`,
    'i',
  )
  const multiM = text.match(multiRx)
  if (multiM) {
    return {
      startDate: frDateToISO(multiM[1], multiM[2], multiM[3]),
      endDate: frDateToISO(multiM[4], multiM[5], multiM[6]),
    }
  }

  // Pattern 3 — jour unique : "[day] [n] [mois] [yyyy]"
  const singleRx = new RegExp(`(?:${DAY_PATTERN})?\\s*(\\d+)\\s+(${MONTH_PATTERN})\\s+(\\d{4})`, 'i')
  const singleM = text.match(singleRx)
  if (singleM) {
    const iso = frDateToISO(singleM[1], singleM[2], singleM[3])
    return { startDate: iso, endDate: iso }
  }

  return { startDate: '', endDate: '' }
}

export function parseGEVacancesHTML(html: string): GEPeriod[] {
  const results: GEPeriod[] = []

  // Cibler les <a href="*/telecharger"> — ce sont les liens de téléchargement calendrier
  const aTagRegex = /<a\s[^>]*href="[^"]*\/telecharger"[^>]*>/gi

  for (const aMatch of html.matchAll(aTagRegex)) {
    const tag = aMatch[0]
    const tagPos = aMatch.index!

    // Lire title="..." : contient le texte de date propre, sans HTML imbriqué
    const titleMatch = tag.match(/title="([^"]+)"/)
    if (!titleMatch) continue
    const dateText = titleMatch[1].trim()

    // Ignorer les entrées sans mois français reconnu
    if (!new RegExp(MONTH_PATTERN, 'i').test(dateText)) continue

    // Trouver le <strong> précédent le plus proche → label de la période
    const before = html.slice(0, tagPos)
    const strongs = [...before.matchAll(/<strong>([^<]+)<\/strong>/gi)]
    if (strongs.length === 0) continue
    const label = strongs[strongs.length - 1][1].trim()

    // Ignorer les rentrées scolaires (pas une fermeture de ludothèque)
    if (/rentrée\s+scolaire/i.test(label)) continue

    // Parser les dates depuis le title
    const { startDate, endDate } = parseFrenchDates(dateText)
    if (startDate && endDate) {
      results.push({ label, startDate, endDate })
    }
  }

  return results
}

/**
 * Dérive l'année académique genevoise à partir d'une date.
 * Mois >= 8 (août) → année X vers X+1 ; sinon X-1 vers X.
 * "2026-08-17" → "2026-2027" | "2027-01-10" → "2026-2027"
 */
export function geAcademicYear(date: string): string {
  const year = parseInt(date.slice(0, 4), 10)
  const month = parseInt(date.slice(5, 7), 10)
  const base = month >= 8 ? year : year - 1
  return `${base}-${base + 1}`
}

/**
 * Retourne toutes les années académiques couvertes par une saison.
 * Si la saison couvre deux années scolaires, retourne les deux.
 */
export function geAcademicYears(seasonStart: string, seasonEnd: string): string[] {
  const startAY = geAcademicYear(seasonStart)
  const endAY = geAcademicYear(seasonEnd)
  return startAY === endAY ? [startAY] : [startAY, endAY]
}
