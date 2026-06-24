<script lang="ts">
  import type { Component } from 'svelte'
  import ModuleTile from '$lib/components/dashboard/ModuleTile.svelte'
  import QuickActionCard from '$lib/components/dashboard/QuickActionCard.svelte'
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
  import ClipboardCheckIcon from '@lucide/svelte/icons/clipboard-check'
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2'
  import WrenchIcon from '@lucide/svelte/icons/wrench'
  import { Badge } from '$lib/components/ui/badge/index.js'

  let { data } = $props()

  const d = $derived(data.dashboard)
  const base = $derived(`/${data.ludo.slug}`)

  // Objets à traiter regroupés par thème (depuis les check-ups des installations
  // en cours). Préserve l'ordre d'arrivée des thèmes.
  const problemGroups = $derived.by(() => {
    const map = new Map<
      string,
      { themeId: string; themeName: string; items: typeof data.problematicItems }
    >()
    for (const item of data.problematicItems) {
      const group = map.get(item.themeId)
      if (group) group.items.push(item)
      else
        map.set(item.themeId, { themeId: item.themeId, themeName: item.themeName, items: [item] })
    }
    return [...map.values()]
  })

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
    <a href={`${base}/frequentation?new=1`} class="hero-action">
      <span class="hero-icon" aria-hidden="true"><ClipboardListIcon size={24} /></span>
      <span class="hero-label">Clôturer une ouverture</span>
    </a>
    <div class="action-pair">
      <QuickActionCard
        href={`${base}/supplies?new=1`}
        icon={PackageIcon}
        label="Demande de matériel"
      />
      <QuickActionCard
        href={`${base}/games?new=1`}
        icon={DicesIcon}
        label="Nouveau souhait de jeu"
      />
    </div>
    <QuickActionCard
      href={`${base}/themes`}
      icon={ClipboardCheckIcon}
      label="Check-up de thème"
      full
    />
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

  {#if problemGroups.length > 0}
    <section class="block" aria-label="Objets à traiter">
      <h2>Objets à traiter</h2>
      <div class="problems">
        {#each problemGroups as group (group.themeId)}
          <a class="problem-group" href="{base}/themes/{group.themeId}">
            <span class="problem-head">
              <WrenchIcon size={16} aria-hidden="true" />
              <strong>{group.themeName}</strong>
            </span>
            <ul>
              {#each group.items as item (item.installationId + item.itemName)}
                <li>
                  <span class="item-name">{item.itemName}</span>
                  {#if item.condition === 'a_reparer'}
                    <Badge variant="warning">À réparer</Badge>
                  {:else}
                    <Badge variant="destructive">Manquant</Badge>
                  {/if}
                </li>
              {/each}
            </ul>
          </a>
        {/each}
      </div>
    </section>
  {/if}

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
    flex-direction: column;
    gap: var(--space-3);
  }
  .action-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  /* Action dominante du quotidien : grand bouton plein, icône en pastille. */
  .hero-action {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--ludo-color);
    color: var(--text-inverse);
    text-decoration: none;
    box-shadow: var(--shadow-sm);
    transition: transform var(--dur-fast) var(--ease-out-strong);
  }
  .hero-action:hover {
    transform: translateY(-2px);
  }
  .hero-action:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .hero-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.2);
  }
  .hero-label {
    font-size: var(--text-h2);
    font-weight: var(--weight-bold);
    line-height: var(--leading-tight);
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

  .problems {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .problem-group {
    display: block;
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: inherit;
    transition: border-color var(--dur-fast) var(--ease-out-strong);
  }
  .problem-group:hover {
    border-color: var(--border-strong);
  }
  .problem-group:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .problem-head {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-main);
    margin-bottom: var(--space-2);
  }
  .problem-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .problem-group li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--border);
  }
  .item-name {
    color: var(--text-main);
    margin-right: auto;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  /* Desktop : 4 colonnes → les 8 tuiles s'alignent en 4×2. */
  @media (min-width: 768px) {
    .tiles {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
