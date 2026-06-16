import type { Component } from 'svelte'
import HouseIcon from '@lucide/svelte/icons/house'
import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days'
import BoxesIcon from '@lucide/svelte/icons/boxes'
import CalendarOffIcon from '@lucide/svelte/icons/calendar-off'
import Share2Icon from '@lucide/svelte/icons/share-2'
import UsersIcon from '@lucide/svelte/icons/users'

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
      label: 'Thèmes',
      href: `${base}/themes`,
      icon: BoxesIcon,
      match: (p) => p.startsWith(`${base}/themes`),
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
      label: 'Réseau',
      href: '/reseau/aide',
      icon: Share2Icon,
      match: (p) => p.startsWith('/reseau'),
      zones: ['sidebar', 'tabbar'],
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
