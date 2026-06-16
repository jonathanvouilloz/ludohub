<script lang="ts">
  import { page } from '$app/state'
  import type { NavDest } from './nav-config'

  let { dest, layout = 'stack' }: { dest: NavDest; layout?: 'stack' | 'row' } = $props()

  const active = $derived(dest.match(page.url.pathname))
  const Icon = $derived(dest.icon)
</script>

<a
  href={dest.href}
  class="nav-item nav-item--{layout}"
  class:nav-item--active={active}
  aria-current={active ? 'page' : undefined}
>
  <!-- Emplacement réservé badge Notifications (epic 10) : wrapper .nav-item__icon -->
  <span class="nav-item__icon">
    <Icon size={24} aria-hidden="true" />
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
  .nav-item__label {
    font-size: var(--text-label);
    font-weight: var(--weight-medium);
  }

  /* Vertical : icône au-dessus du label (sidebar + tab bar). */
  .nav-item--stack {
    flex-direction: column;
    justify-content: center;
    gap: var(--space-1);
    min-height: 44px;
    padding: var(--space-2) var(--space-1);
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
