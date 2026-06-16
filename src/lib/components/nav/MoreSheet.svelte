<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { isResponsable } from '$lib/utils/permissions.js'
  import type { LudothequeRow, MemberRow } from '$lib/server/schema.js'
  import LogOutIcon from '@lucide/svelte/icons/log-out'
  import XIcon from '@lucide/svelte/icons/x'
  import NavItem from './NavItem.svelte'
  import LudoBadge from './LudoBadge.svelte'
  import { buildNavConfig } from './nav-config'

  let {
    ludo,
    member,
    notifCount = 0,
    open = $bindable(false),
  }: { ludo: LudothequeRow; member: MemberRow; notifCount?: number; open?: boolean } = $props()

  const items = $derived(
    buildNavConfig(ludo.slug).filter(
      (d) => d.zones.includes('sheet') && (!d.responsableOnly || isResponsable(member)),
    ),
  )

  let closeBtn = $state<HTMLButtonElement | null>(null)

  function close() {
    open = false
  }
  function onKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') close()
  }

  // Focus le bouton de fermeture à l'ouverture (focus trap basique).
  $effect(() => {
    if (open) closeBtn?.focus()
  })

  // Refermer dès qu'un lien de la sheet déclenche une navigation.
  afterNavigate(() => {
    open = false
  })
</script>

<svelte:window onkeydown={onKeydown} />

<div class="more-sheet" class:more-sheet--open={open} aria-hidden={!open}>
  <button
    type="button"
    class="more-sheet__overlay"
    tabindex={open ? 0 : -1}
    aria-label="Fermer le menu"
    onclick={close}
  ></button>

  <div class="more-sheet__panel" role="dialog" aria-modal="true" aria-label="Plus">
    <header class="more-sheet__header">
      <span class="more-sheet__title">Plus</span>
      <button
        bind:this={closeBtn}
        type="button"
        class="more-sheet__close"
        aria-label="Fermer"
        onclick={close}
      >
        <XIcon size={20} aria-hidden="true" />
      </button>
    </header>

    <nav class="more-sheet__nav" aria-label="Navigation secondaire">
      {#each items as dest (dest.href)}
        <NavItem {dest} layout="row" badge={dest.badgeKey === 'notifications' ? notifCount : 0} />
      {/each}
    </nav>

    <div class="more-sheet__footer">
      <LudoBadge {ludo} {member} />
      <form method="POST" action="/auth/logout">
        <button type="submit" class="logout">
          <LogOutIcon size={20} aria-hidden="true" />
          <span>Déconnexion</span>
        </button>
      </form>
    </div>
  </div>
</div>

<style>
  .more-sheet {
    position: fixed;
    inset: 0;
    z-index: 50;
    visibility: hidden;
    pointer-events: none;
  }
  .more-sheet--open {
    visibility: visible;
    pointer-events: auto;
  }

  .more-sheet__overlay {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    background: rgba(30, 50, 80, 0.4);
    opacity: 0;
    cursor: pointer;
    transition: opacity var(--dur-base) var(--ease-drawer);
  }
  .more-sheet--open .more-sheet__overlay {
    opacity: 1;
  }

  .more-sheet__panel {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
    background: var(--bg-card);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: var(--shadow-lg);
    transform: translateY(100%);
    transition: transform var(--dur-base) var(--ease-drawer);
  }
  .more-sheet--open .more-sheet__panel {
    transform: translateY(0);
  }

  .more-sheet__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .more-sheet__title {
    font-size: var(--text-h2);
    font-weight: var(--weight-bold);
    color: var(--text-main);
  }
  .more-sheet__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .more-sheet__close:hover {
    background: var(--bg-hover);
  }

  .more-sheet__nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .more-sheet__footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }

  .logout {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--danger);
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
    font-family: inherit;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .logout:hover {
    background: var(--danger-light);
  }
  .more-sheet__close:focus-visible,
  .logout:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  /* Sheet uniquement sur mobile : sur desktop la sidebar couvre tout. */
  @media (min-width: 768px) {
    .more-sheet {
      display: none;
    }
  }
</style>
