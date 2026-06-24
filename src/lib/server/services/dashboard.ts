import { listSessionsInRange } from './attendance.js'
import { listSupplyRequests } from './supplies.js'
import { listGameWishes } from './wishes.js'
import { getActiveSeason, getMyUpcomingSaturdays } from './planning.js'
import { listThemes } from './themes.js'
import { getFeed } from './help.js'
import { getActiveMembersByLudo, countResponsablesActifs } from '../db/members.js'
import { getPendingAbsencesByLudo, getApprovedAbsencesInRange } from '../db/absences.js'
import { isResponsable } from '$lib/utils/permissions.js'
import { daysBetween, formatDayWeekday, formatMonthYear, toDateString } from '$lib/utils/dates.js'
import type { LudothequeRow, MemberRow } from '../schema.js'

export type ReminderTone = 'info' | 'warn' | 'urgent'

export type ReminderModule =
  | 'frequentation'
  | 'supplies'
  | 'games'
  | 'planning'
  | 'absences'
  | 'themes'
  | 'reseau'
  | 'notifs'

export type Reminder = {
  id: string
  module: ReminderModule
  tone: ReminderTone
  label: string
  href: string
  count?: number
}

export type DashboardData = {
  today: string
  modules: {
    frequentation: {
      monthLabel: string
      sessions: number
      adults: number
      children: number
      loans: number
    }
    supplies: { pending: number; ordered: number; total: number }
    games: { wanted: number; bought: number }
    planning: {
      seasonName: string | null
      myNextSaturday: { date: string; seasonName: string } | null
      myUpcomingCount: number
    }
    absences: { pending: number; approvedUpcoming: number }
    themes: { total: number; activeInstallations: number; checkupMissingItems: number }
    reseau: { openRequests: number; mineOpen: number }
    notifs: { unread: number }
    team: { activeMembers: number; responsables: number }
  }
  reminders: Reminder[]
}

/** Bornes ISO `YYYY-MM-DD` du mois civil contenant `now`. */
function monthBounds(now: Date): { start: string; end: string } {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

/** Ordre d'affichage des rappels : le plus pressant en premier. */
const TONE_RANK: Record<ReminderTone, number> = { urgent: 0, warn: 1, info: 2 }

/**
 * Agrège, en un seul aller-retour parallèle, les métriques de chaque module et
 * construit la liste de rappels « à faire » adaptée au rôle du membre. `today`
 * est figé une fois côté serveur et passé aux helpers de dates (jamais de
 * `new Date()` dans le composant). `notifCount` est réutilisé du layout pour
 * éviter une seconde requête de badge.
 */
export async function getDashboardData(
  ludo: LudothequeRow,
  member: MemberRow,
  notifCount: number,
  problematicCount: number,
): Promise<DashboardData> {
  const now = new Date()
  const today = toDateString(now)
  const monthLabel = formatMonthYear(now)
  const { start: monthStart, end: monthEnd } = monthBounds(now)
  const in30 = toDateString(new Date(now.getTime() + 30 * 86_400_000))
  const canManage = isResponsable(member)

  const [
    sessions,
    supplies,
    wishes,
    activeSeason,
    myUpcoming,
    themes,
    feed,
    activeMembers,
    responsables,
    approvedUpcoming,
    pendingAbsences,
  ] = await Promise.all([
    listSessionsInRange(ludo.id, monthStart, monthEnd),
    listSupplyRequests(ludo.id),
    listGameWishes(ludo.id),
    getActiveSeason(ludo.id),
    getMyUpcomingSaturdays(member.id),
    listThemes(ludo.id),
    getFeed(ludo.id, member.id),
    getActiveMembersByLudo(ludo.id),
    countResponsablesActifs(ludo.id),
    getApprovedAbsencesInRange(ludo.id, today, in30),
    canManage ? getPendingAbsencesByLudo(ludo.id) : Promise.resolve([]),
  ])

  // ─── Fréquentation : sommes du mois courant ───────────────────────────────
  const freq = sessions.reduce(
    (acc, s) => {
      acc.adults += s.adultsCount
      acc.children += s.childrenCount
      acc.loans += s.loansCount
      return acc
    },
    { adults: 0, children: 0, loans: 0 },
  )

  // ─── Matériel ─────────────────────────────────────────────────────────────
  const suppliesPending = supplies.filter((s) => s.status === 'en_attente').length
  const suppliesOrdered = supplies.filter((s) => s.status === 'commande').length

  // ─── Jeux ─────────────────────────────────────────────────────────────────
  const gamesWanted = wishes.filter((w) => w.status === 'souhaite').length
  const gamesBought = wishes.filter((w) => w.status === 'achete').length

  // ─── Planning ─────────────────────────────────────────────────────────────
  // myUpcoming est déjà trié par date ascendante (getUpcomingAssignmentsForMember).
  const myNextSaturday = myUpcoming[0] ?? null

  // ─── Thèmes : installations en cours + objets à traiter (à réparer / manquants) ─
  // `checkupMissingItems` vient de `listProblematicItems` (passé par le load) :
  // même source que le bloc « objets à traiter » de l'accueil, scopé sur la ludo
  // où c'est installé (inclut les thèmes empruntés).
  const activeInstallations = themes.filter((t) => t.installations.length > 0).length
  const checkupMissingItems = problematicCount

  // ─── Réseau ───────────────────────────────────────────────────────────────
  const mineOpen = feed.filter((f) => f.isMine).length

  // ─── Rappels « à faire » ──────────────────────────────────────────────────
  const base = `/${ludo.slug}`
  const reminders: Reminder[] = []

  if (notifCount > 0) {
    reminders.push({
      id: 'notifs',
      module: 'notifs',
      tone: 'urgent',
      label: `${notifCount} notification${notifCount > 1 ? 's' : ''} à traiter`,
      href: '/reseau/notifications',
      count: notifCount,
    })
  }
  if (canManage && pendingAbsences.length > 0) {
    reminders.push({
      id: 'absences',
      module: 'absences',
      tone: 'warn',
      label: `${pendingAbsences.length} demande${pendingAbsences.length > 1 ? 's' : ''} d'absence à valider`,
      href: `${base}/absences`,
      count: pendingAbsences.length,
    })
  }
  if (suppliesPending > 0) {
    reminders.push({
      id: 'supplies',
      module: 'supplies',
      tone: 'warn',
      label: `${suppliesPending} demande${suppliesPending > 1 ? 's' : ''} de matériel en attente`,
      href: `${base}/supplies`,
      count: suppliesPending,
    })
  }
  if (checkupMissingItems > 0) {
    reminders.push({
      id: 'themes',
      module: 'themes',
      tone: 'warn',
      label: `${checkupMissingItems} objet${checkupMissingItems > 1 ? 's' : ''} à traiter en installation`,
      href: `${base}/themes`,
      count: checkupMissingItems,
    })
  }
  if (myNextSaturday) {
    const inDays = daysBetween(today, myNextSaturday.date)
    const when = inDays <= 0 ? "aujourd'hui" : inDays === 1 ? 'demain' : `dans ${inDays} jours`
    reminders.push({
      id: 'planning',
      module: 'planning',
      tone: 'info',
      label: `Votre prochain samedi : ${formatDayWeekday(myNextSaturday.date)} (${when})`,
      href: `${base}/planning`,
    })
  }
  if (feed.length > 0) {
    reminders.push({
      id: 'reseau',
      module: 'reseau',
      tone: 'info',
      label: `${feed.length} demande${feed.length > 1 ? 's' : ''} d'aide ouverte${feed.length > 1 ? 's' : ''} sur le réseau`,
      href: '/reseau/aide',
      count: feed.length,
    })
  }

  reminders.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone])

  return {
    today,
    modules: {
      frequentation: {
        monthLabel,
        sessions: sessions.length,
        adults: freq.adults,
        children: freq.children,
        loans: freq.loans,
      },
      supplies: { pending: suppliesPending, ordered: suppliesOrdered, total: supplies.length },
      games: { wanted: gamesWanted, bought: gamesBought },
      planning: {
        seasonName: activeSeason?.name ?? null,
        myNextSaturday,
        myUpcomingCount: myUpcoming.length,
      },
      absences: { pending: pendingAbsences.length, approvedUpcoming: approvedUpcoming.length },
      themes: { total: themes.length, activeInstallations, checkupMissingItems },
      reseau: { openRequests: feed.length, mineOpen },
      notifs: { unread: notifCount },
      team: { activeMembers: activeMembers.length, responsables },
    },
    reminders,
  }
}
