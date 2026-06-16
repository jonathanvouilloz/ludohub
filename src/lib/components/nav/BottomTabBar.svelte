<script lang="ts">
  import type { LudothequeRow } from '$lib/server/schema.js'
  import MenuIcon from '@lucide/svelte/icons/menu'
  import NavItem from './NavItem.svelte'
  import { buildNavConfig } from './nav-config'

  let { ludo, onMore }: { ludo: LudothequeRow; onMore: () => void } = $props()

  const items = $derived(buildNavConfig(ludo.slug).filter((d) => d.zones.includes('tabbar')))
</script>

<nav class="bottom-tab-bar" aria-label="Navigation principale">
  {#each items as dest (dest.href)}
    <NavItem {dest} />
  {/each}
  <button type="button" class="tab-more" onclick={onMore}>
    <span class="tab-more__icon"><MenuIcon size={24} aria-hidden="true" /></span>
    <span class="tab-more__label">Plus</span>
  </button>
</nav>

<style>
  .bottom-tab-bar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 40;
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    padding-bottom: calc(var(--space-1) + env(safe-area-inset-bottom));
    background: var(--bg-sidebar);
    border-top: 1px solid var(--border);
  }
  .bottom-tab-bar :global(.nav-item) {
    flex: 1;
  }

  .tab-more {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-height: 44px;
    padding: var(--space-2) var(--space-1);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-main);
    font-family: inherit;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .tab-more:hover {
    background: var(--bg-hover);
  }
  .tab-more:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .tab-more__icon {
    display: inline-flex;
  }
  .tab-more__label {
    font-size: var(--text-label);
    font-weight: var(--weight-medium);
  }

  /* Visible uniquement sous le breakpoint tablette (--bp-md = 768px). */
  @media (min-width: 768px) {
    .bottom-tab-bar {
      display: none;
    }
  }
</style>
