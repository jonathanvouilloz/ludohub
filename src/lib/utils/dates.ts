/**
 * Génère tous les samedis entre deux dates (inclusif).
 * Utilisé pour créer automatiquement les slots d'une saison.
 */
export function getSwissSaturdays(startDate: Date, endDate: Date): Date[] {
  const saturdays: Date[] = []
  const current = new Date(startDate)

  // Avancer jusqu'au premier samedi
  const day = current.getDay()
  if (day !== 6) {
    const daysUntilSaturday = (6 - day + 7) % 7
    current.setDate(current.getDate() + daysUntilSaturday)
  }

  while (current <= endDate) {
    saturdays.push(new Date(current))
    current.setDate(current.getDate() + 7)
  }

  return saturdays
}

/**
 * Formate une date en string locale suisse (fr-CH).
 */
export function formatDateCH(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Formate une date courte (DD.MM.YYYY).
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-CH')
}

/**
 * Retourne true si une date est un samedi.
 */
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6
}

/**
 * Retourne true si `date` est comprise dans [start, end] (bornes incluses).
 * Les trois valeurs sont des strings ISO `YYYY-MM-DD` : la comparaison
 * lexicographique est sûre car le format est zéro-paddé et trié naturellement.
 */
export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

/**
 * Convertit une date ISO en string YYYY-MM-DD (pour les colonnes Drizzle `date`).
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Calcule le dimanche de Pâques (algorithme de Butcher) pour une année donnée.
 */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Décale une date d'un nombre de jours (copie, sans muter l'original). */
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Retourne true si la date est un jour férié reconnu dans le canton de Genève.
 * Couvre les fériés à date fixe et les fériés mobiles liés à Pâques, plus les
 * spécificités genevoises (Jeûne genevois, Restauration de la République).
 * Sert à pré-suggérer l'annulation d'un samedi férié (le responsable confirme).
 */
export function isGenevaHoliday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const md = (m: number, day: number) => m === d.getMonth() + 1 && day === d.getDate()

  // Fériés à date fixe
  if (md(1, 1)) return true // Nouvel An
  if (md(8, 1)) return true // Fête nationale suisse
  if (md(12, 25)) return true // Noël
  if (md(12, 31)) return true // Restauration de la République (GE)

  // Fériés mobiles (relatifs à Pâques)
  const easter = easterSunday(year)
  const sameDay = (other: Date) =>
    d.getFullYear() === other.getFullYear() &&
    d.getMonth() === other.getMonth() &&
    d.getDate() === other.getDate()

  if (sameDay(addDays(easter, -2))) return true // Vendredi saint
  if (sameDay(addDays(easter, 1))) return true // Lundi de Pâques
  if (sameDay(addDays(easter, 39))) return true // Ascension
  if (sameDay(addDays(easter, 50))) return true // Lundi de Pentecôte

  // Jeûne genevois : jeudi suivant le 1er dimanche de septembre
  const sept1 = new Date(year, 8, 1)
  const firstSunday = addDays(sept1, (7 - sept1.getDay()) % 7)
  const jeuneGenevois = addDays(firstSunday, 4)
  if (sameDay(jeuneGenevois)) return true

  return false
}
