import type { Component } from 'svelte'
import HouseIcon from '@lucide/svelte/icons/house'
import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days'
import BoxesIcon from '@lucide/svelte/icons/boxes'
import CalendarOffIcon from '@lucide/svelte/icons/calendar-off'
import Share2Icon from '@lucide/svelte/icons/share-2'
import UsersIcon from '@lucide/svelte/icons/users'
import PackageIcon from '@lucide/svelte/icons/package'
import DicesIcon from '@lucide/svelte/icons/dices'
import BellIcon from '@lucide/svelte/icons/bell'
import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list'

/** Zone(s) du shell où une destination apparaît. */
export type NavZone = 'sidebar' | 'tabbar' | 'sheet'

export type NavDest = {
  label: string
  href: string
  icon: Component
  /** Item actif quand `match(pathname)` est vrai. */
  match: (pathname: string) => boolean
  zones: NavZone[]
  /** Réservé aux responsables (masqué pour les membres simples). */
  responsableOnly?: boolean
  /** Clé de badge dynamique alimentée par le shell (compteur de notifs). */
  badgeKey?: 'notifications'
}

/**
 * Source unique des destinations de navigation, mutualisée entre la sidebar
 * desktop, la tab bar mobile et la sheet « Plus ». Le slug est résolu par
 * l'appelant (depuis l'URL `[ludo]` ou la session pour `/reseau/*`).
 */
export function buildNavConfig(slug: string): NavDest[] {
  const base = `/${slug}`
  return [
    {
      label: 'Accueil',
      href: base,
      icon: HouseIcon,
      match: (p) => p === base,
      zones: ['sidebar', 'tabbar'],
    },
    {
      label: 'Planning',
      href: `${base}/planning`,
      icon: CalendarDaysIcon,
      match: (p) => p.startsWith(`${base}/planning`),
      zones: ['sidebar', 'tabbar'],
    },
    {
      label: 'Matériel',
      href: `${base}/supplies`,
      icon: PackageIcon,
      match: (p) => p.startsWith(`${base}/supplies`),
      zones: ['sidebar', 'tabbar'],
    },
    {
      label: 'Jeux',
      href: `${base}/games`,
      icon: DicesIcon,
      match: (p) => p.startsWith(`${base}/games`),
      zones: ['sidebar', 'tabbar'],
    },
    {
      label: 'Absences',
      href: `${base}/absences`,
      icon: CalendarOffIcon,
      match: (p) => p.startsWith(`${base}/absences`),
      zones: ['sidebar', 'sheet'],
    },
    {
      label: 'Fréquentation',
      href: `${base}/frequentation`,
      icon: ClipboardListIcon,
      match: (p) => p.startsWith(`${base}/frequentation`),
      zones: ['sidebar', 'sheet'],
    },
    {
      label: 'Thèmes',
      href: `${base}/themes`,
      icon: BoxesIcon,
      match: (p) => p.startsWith(`${base}/themes`),
      zones: ['sidebar', 'sheet'],
    },
    {
      label: 'Réseau',
      href: '/reseau/aide',
      icon: Share2Icon,
      match: (p) => p.startsWith('/reseau') && !p.startsWith('/reseau/notifications'),
      zones: ['sidebar', 'sheet'],
    },
    {
      label: 'Notifications',
      href: '/reseau/notifications',
      icon: BellIcon,
      match: (p) => p.startsWith('/reseau/notifications'),
      zones: ['sidebar', 'sheet'],
      badgeKey: 'notifications',
    },
    {
      label: 'Équipe',
      href: `${base}/settings/membres`,
      icon: UsersIcon,
      match: (p) => p.startsWith(`${base}/settings`),
      zones: ['sidebar', 'sheet'],
      responsableOnly: true,
    },
  ]
}
