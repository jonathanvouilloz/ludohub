<script lang="ts">
  import type { Snippet } from 'svelte'
  import { navigating } from '$app/state'
  import type { LudothequeRow, MemberRow } from '$lib/server/schema.js'
  import { PageSkeleton } from '$lib/components/ui/skeleton/index.js'
  import AppSidebar from './AppSidebar.svelte'
  import BottomTabBar from './BottomTabBar.svelte'
  import MoreSheet from './MoreSheet.svelte'

  let {
    ludo,
    member,
    notifCount = 0,
    children,
  }: {
    ludo: LudothequeRow
    member: MemberRow
    notifCount?: number
    children: Snippet
  } = $props()

  let sheetOpen = $state(false)

  // Pages dont le `load` interroge la DB : on affiche un skeleton pendant la
  // navigation client vers elles (ou un rechargement en place, ex. changement
  // de saison sur la fréquentation). Les pages légères naviguent normalement.
  const HEAVY_ROUTES = new Set([
    '/[ludo]/themes',
    '/[ludo]/planning',
    '/[ludo]/planning/saisons',
    '/[ludo]/planning/saisons/[id]',
    '/[ludo]/frequentation',
    '/[ludo]/absences',
    '/reseau/themes',
    '/reseau/aide',
    '/reseau/notifications',
  ])
  const loadingHeavy = $derived(
    !!navigating.to?.route.id && HEAVY_ROUTES.has(navigating.to.route.id),
  )
</script>

<div class="app-shell">
  <AppSidebar {ludo} {member} {notifCount} />
  <main class="app-shell__content">
    {#if loadingHeavy}
      <PageSkeleton />
    {:else}
      {@render children()}
    {/if}
  </main>
</div>

<BottomTabBar {ludo} {notifCount} onMore={() => (sheetOpen = true)} />
<MoreSheet {ludo} {member} {notifCount} bind:open={sheetOpen} />

<style>
  .app-shell {
    display: grid;
    grid-template-columns: var(--sidebar-width) 1fr;
    min-height: 100dvh;
  }
  .app-shell__content {
    min-width: 0;
  }

  /* Sous le breakpoint tablette : une seule colonne, la tab bar (fixe) prend
     le relais ; on réserve l'espace bas pour ne pas masquer le contenu. */
  @media (max-width: 767px) {
    .app-shell {
      grid-template-columns: 1fr;
    }
    .app-shell__content {
      padding-bottom: calc(var(--space-16) + env(safe-area-inset-bottom));
    }
  }
</style>
