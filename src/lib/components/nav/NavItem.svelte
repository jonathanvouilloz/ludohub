<script lang="ts">
  import { page } from '$app/state'
  import type { NavDest } from './nav-config'

  let {
    dest,
    layout = 'stack',
    badge = 0,
  }: { dest: NavDest; layout?: 'stack' | 'row'; badge?: number } = $props()

  const active = $derived(dest.match(page.url.pathname))
  const Icon = $derived(dest.icon)
  const badgeText = $derived(badge > 9 ? '9+' : String(badge))
</script>

<a
  href={dest.href}
  class="nav-item nav-item--{layout}"
  class:nav-item--active={active}
  aria-current={active ? 'page' : undefined}
>
  <span class="nav-item__icon">
    <Icon size={24} aria-hidden="true" />
    {#if badge > 0}
      <span class="nav-item__badge" aria-label="{badge} notification(s) à traiter">{badgeText}</span
      >
    {/if}
  </span>
  <span class="nav-item__label">{dest.label}</span>
</a>

<style>
  .nav-item {
    display: flex;
    align-items: center;
    color: var(--text-main);
    text-decoration: none;
    border-radius: var(--radius-sm);
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .nav-item:hover,
  .nav-item:active,
  .nav-item:focus {
    text-decoration: none;
  }
  .nav-item:hover {
    background: var(--bg-hover);
  }
  .nav-item--active {
    background: var(--ludo-color);
    color: var(--text-inverse);
  }
  .nav-item--active:hover {
    background: var(--ludo-color);
  }
  .nav-item:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .nav-item__icon {
    display: inline-flex;
    position: relative;
  }
  .nav-item__badge {
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
  .nav-item__label {
    font-size: var(--text-label);
    font-weight: var(--weight-medium);
    white-space: nowrap;
  }

  /* Vertical : icône au-dessus du label (sidebar + tab bar). */
  .nav-item--stack {
    flex-direction: column;
    justify-content: center;
    gap: var(--space-1);
    min-height: 44px;
    padding: var(--space-2) 0;
    text-align: center;
  }

  /* Horizontal : icône + label alignés (sheet « Plus »). */
  .nav-item--row {
    gap: var(--space-3);
    min-height: 44px;
    padding: var(--space-3);
  }
  .nav-item--row .nav-item__label {
    font-size: var(--text-body);
  }
</style>
