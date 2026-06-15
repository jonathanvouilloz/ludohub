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
 * Convertit une date ISO en string YYYY-MM-DD (pour les colonnes Drizzle `date`).
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}
