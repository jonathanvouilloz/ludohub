<script lang="ts">
  import type { LudothequeRow } from '$lib/server/schema.js'
  import MenuIcon from '@lucide/svelte/icons/menu'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import NavItem from './NavItem.svelte'
  import { buildNavConfig } from './nav-config'

  let {
    ludo,
    notifCount = 0,
    onMore,
  }: { ludo: LudothequeRow; notifCount?: number; onMore: () => void } = $props()

  const items = $derived(buildNavConfig(ludo.slug).filter((d) => d.zones.includes('tabbar')))
  // FAB central : on répartit les onglets de part et d'autre du bouton d'action.
  const left = $derived(items.slice(0, Math.ceil(items.length / 2)))
  const right = $derived(items.slice(Math.ceil(items.length / 2)))
  const fabHref = $derived(`/${ludo.slug}/frequentation?new=1`)
  const badgeText = $derived(notifCount > 9 ? '9+' : String(notifCount))
</script>

<nav class="bottom-tab-bar" aria-label="Navigation principale">
  {#each left as dest (dest.href)}
    <NavItem {dest} />
  {/each}

  <a href={fabHref} class="tab-fab" aria-label="Clôturer une ouverture">
    <PlusIcon size={26} aria-hidden="true" />
  </a>

  {#each right as dest (dest.href)}
    <NavItem {dest} />
  {/each}

  <button type="button" class="tab-more" onclick={onMore}>
    <span class="tab-more__icon">
      <MenuIcon size={24} aria-hidden="true" />
      {#if notifCount > 0}
        <span class="tab-more__badge" aria-label="{notifCount} notification(s) à traiter"
          >{badgeText}</span
        >
      {/if}
    </span>
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

  /* Bouton d'action central : clôturer une ouverture (action la plus fréquente).
     Surélevé au-dessus de la barre, rond, à la couleur de la ludo. */
  .tab-fab {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    margin-top: -20px;
    border-radius: var(--radius-pill);
    background: var(--ludo-color);
    color: var(--text-inverse);
    text-decoration: none;
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.18));
    transition: transform var(--dur-fast) var(--ease-out-strong);
  }
  .tab-fab:hover,
  .tab-fab:active,
  .tab-fab:focus {
    text-decoration: none;
  }
  .tab-fab:active {
    transform: scale(0.94);
  }
  .tab-fab:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
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
    position: relative;
  }
  .tab-more__badge {
    position: absolute;
    top: -6px;
    left: 100%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--danger);
    color: var(--text-inverse);
    font-size: 0.625rem;
    font-weight: var(--weight-bold);
    line-height: 1;
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
