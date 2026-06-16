<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { LudothequeRow, MemberRow } from '$lib/server/schema.js'
  import AppSidebar from './AppSidebar.svelte'
  import BottomTabBar from './BottomTabBar.svelte'
  import MoreSheet from './MoreSheet.svelte'

  let { ludo, member, children }: { ludo: LudothequeRow; member: MemberRow; children: Snippet } =
    $props()

  let sheetOpen = $state(false)
</script>

<div class="app-shell">
  <AppSidebar {ludo} {member} />
  <main class="app-shell__content">
    {@render children()}
  </main>
</div>

<BottomTabBar {ludo} onMore={() => (sheetOpen = true)} />
<MoreSheet {ludo} {member} bind:open={sheetOpen} />

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
