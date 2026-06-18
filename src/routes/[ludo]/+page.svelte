<script lang="ts">
  import type { Component } from 'svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import ModuleTile from '$lib/components/dashboard/ModuleTile.svelte'
  import ReminderItem from '$lib/components/dashboard/ReminderItem.svelte'
  import { formatDayWeekday } from '$lib/utils/dates.js'
  import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list'
  import PackageIcon from '@lucide/svelte/icons/package'
  import DicesIcon from '@lucide/svelte/icons/dices'
  import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days'
  import CalendarOffIcon from '@lucide/svelte/icons/calendar-off'
  import BoxesIcon from '@lucide/svelte/icons/boxes'
  import Share2Icon from '@lucide/svelte/icons/share-2'
  import BellIcon from '@lucide/svelte/icons/bell'
  import UsersIcon from '@lucide/svelte/icons/users'
  import ClipboardCheckIcon from '@lucide/svelte/icons/clipboard-check'
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2'

  let { data } = $props()

  const d = $derived(data.dashboard)
  const base = $derived(`/${data.ludo.slug}`)

  type Tile = {
    href: string
    icon: Component
    label: string
    value: number | string
    unit?: string
    hint?: string
    badge?: number
  }

  // Tuiles dans l'ordre d'usage demandé. Équipe n'apparaît que pour les responsables.
  const tiles = $derived.by<Tile[]>(() => {
    const m = d.modules
    const list: Tile[] = [
      {
        href: `${base}/frequentation`,
        icon: ClipboardListIcon,
        label: 'Fréquentation',
        value: m.frequentation.sessions,
        unit: 'séances ce mois',
        hint: `${m.frequentation.adults} adultes · ${m.frequentation.children} enfants`,
      },
      {
        href: `${base}/supplies`,
        icon: PackageIcon,
        label: 'Matériel',
        value: m.supplies.total,
        unit: 'demandes',
        hint: `${m.supplies.pending} en attente`,
        badge: m.supplies.pending,
      },
      {
        href: `${base}/games`,
        icon: DicesIcon,
        label: 'Jeux',
        value: m.games.wanted,
        unit: 'souhaités',
        hint: `${m.games.bought} achetés`,
      },
      {
        href: `${base}/planning`,
        icon: CalendarDaysIcon,
        label: 'Planning',
        value: m.planning.myUpcomingCount,
        unit: 'samedis à venir',
        hint: m.planning.seasonName ?? 'Aucune saison active',
      },
      {
        href: `${base}/absences`,
        icon: CalendarOffIcon,
        label: 'Absences',
        value: m.absences.approvedUpcoming,
        unit: 'à venir (30 j)',
        hint: data.canManage ? `${m.absences.pending} à valider` : 'approuvées',
        badge: data.canManage ? m.absences.pending : undefined,
      },
      {
        href: `${base}/themes`,
        icon: BoxesIcon,
        label: 'Thèmes',
        value: m.themes.total,
        unit: 'au catalogue',
        hint: `${m.themes.activeInstallations} en installation`,
        badge: m.themes.checkupMissingItems,
      },
      {
        href: '/reseau/aide',
        icon: Share2Icon,
        label: 'Réseau',
        value: m.reseau.openRequests,
        unit: "demandes d'aide",
        hint: `${m.reseau.mineOpen} de ma ludo`,
      },
      {
        href: '/reseau/notifications',
        icon: BellIcon,
        label: 'Notifications',
        value: m.notifs.unread,
        unit: 'non lues',
        hint: m.notifs.unread > 0 ? 'à traiter' : 'à jour',
        badge: m.notifs.unread,
      },
    ]
    if (data.canManage) {
      list.push({
        href: `${base}/settings/membres`,
        icon: UsersIcon,
        label: 'Équipe',
        value: m.team.activeMembers,
        unit: 'membres actifs',
        hint: `${m.team.responsables} responsables`,
      })
    }
    return list
  })
</script>

<svelte:head>
  <title>Accueil — {data.ludo.name}</title>
</svelte:head>

<main class="dashboard">
  <header class="greeting">
    <p class="eyebrow" style="color: var(--ludo-color)">{data.ludo.name}</p>
    <h1>Bonjour {data.currentMember.name} 👋</h1>
    <p class="muted">{formatDayWeekday(d.today)}</p>
  </header>

  <section class="quick-actions" aria-label="Actions rapides">
    <Button href={`${base}/frequentation?new=1`}>
      <ClipboardListIcon size={18} aria-hidden="true" />
      Clôturer une ouverture
    </Button>
    <Button href={`${base}/supplies?new=1`} variant="outline">
      <PackageIcon size={18} aria-hidden="true" />
      Demande de matériel
    </Button>
    <Button href={`${base}/games?new=1`} variant="outline">
      <DicesIcon size={18} aria-hidden="true" />
      Nouveau souhait de jeu
    </Button>
    <Button href={`${base}/themes`} variant="outline">
      <ClipboardCheckIcon size={18} aria-hidden="true" />
      Check-up de thème
    </Button>
  </section>

  <section class="block" aria-label="Rappels">
    <h2>À faire</h2>
    {#if d.reminders.length === 0}
      <div class="empty">
        <CheckCircle2Icon size={20} aria-hidden="true" />
        <span>Rien à signaler, tout est à jour.</span>
      </div>
    {:else}
      <div class="reminders">
        {#each d.reminders as reminder (reminder.id)}
          <ReminderItem {reminder} />
        {/each}
      </div>
    {/if}
  </section>

  <section class="block" aria-label="Aperçu des modules">
    <h2>Aperçu</h2>
    <div class="tiles">
      {#each tiles as tile (tile.href)}
        <ModuleTile
          href={tile.href}
          icon={tile.icon}
          label={tile.label}
          value={tile.value}
          unit={tile.unit}
          hint={tile.hint}
          badge={tile.badge}
        />
      {/each}
    </div>
  </section>
</main>

<style>
  .dashboard {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }
  .greeting .eyebrow {
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--text-small);
    margin: 0 0 var(--space-2);
  }
  .greeting h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .greeting .muted {
    color: var(--text-muted);
    margin: 0;
    text-transform: capitalize;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .block h2 {
    margin: 0 0 var(--space-4);
  }

  .empty {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--text-body);
  }

  .reminders {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: var(--space-3);
  }
</style>
