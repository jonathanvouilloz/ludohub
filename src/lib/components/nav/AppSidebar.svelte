<script lang="ts">
  import { isResponsable } from '$lib/utils/permissions.js'
  import type { LudothequeRow, MemberRow } from '$lib/server/schema.js'
  import LogOutIcon from '@lucide/svelte/icons/log-out'
  import NavItem from './NavItem.svelte'
  import LudoBadge from './LudoBadge.svelte'
  import { buildNavConfig } from './nav-config'

  let {
    ludo,
    member,
    notifCount = 0,
  }: { ludo: LudothequeRow; member: MemberRow; notifCount?: number } = $props()

  const items = $derived(
    buildNavConfig(ludo.slug).filter(
      (d) => d.zones.includes('sidebar') && (!d.responsableOnly || isResponsable(member)),
    ),
  )
</script>

<aside class="app-sidebar">
  <nav class="app-sidebar__nav" aria-label="Navigation principale">
    {#each items as dest (dest.href)}
      <NavItem {dest} badge={dest.badgeKey === 'notifications' ? notifCount : 0} />
    {/each}
  </nav>

  <div class="app-sidebar__footer">
    <LudoBadge {ludo} {member} compact />
    <form method="POST" action="/auth/logout">
      <button type="submit" class="logout">
        <LogOutIcon size={24} aria-hidden="true" />
        <span>Quitter</span>
      </button>
    </form>
  </div>
</aside>

<style>
  .app-sidebar {
    position: sticky;
    top: 0;
    align-self: start;
    height: 100dvh;
    width: var(--sidebar-width);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-2);
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
  }

  .app-sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .app-sidebar__footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }

  .logout {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    width: 100%;
    min-height: 44px;
    padding: var(--space-2) var(--space-1);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-medium);
    font-family: inherit;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .logout:hover {
    background: var(--bg-hover);
  }
  .logout:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  /* Masquée sous le breakpoint tablette (--bp-md = 768px) : la tab bar prend le relais. */
  @media (max-width: 767px) {
    .app-sidebar {
      display: none;
    }
  }
</style>
