<script lang="ts">
  import type { Component } from 'svelte'

  let {
    href,
    icon: Icon,
    label,
    value,
    unit = undefined,
    hint = undefined,
    badge = undefined,
  }: {
    href: string
    icon: Component
    label: string
    value: number | string
    unit?: string
    hint?: string
    badge?: number
  } = $props()
</script>

<a {href} class="tile">
  <span class="head">
    <span class="icon" aria-hidden="true"><Icon size={13} /></span>
    <span class="name">{label}</span>
    {#if badge}
      <span class="badge">{badge > 99 ? '99+' : badge}</span>
    {/if}
  </span>
  <span class="metric">
    <span class="num">{value}</span>
    {#if unit}<span class="unit">{unit}</span>{/if}
  </span>
  {#if hint}
    <span class="hint">{hint}</span>
  {/if}
</a>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    color: var(--text-main);
    text-decoration: none;
    transition:
      border-color var(--dur-fast) var(--ease-out-strong),
      transform var(--dur-fast) var(--ease-out-strong);
  }
  .tile:hover {
    border-color: var(--ludo-color);
    transform: translateY(-2px);
  }
  .tile:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    /* Hauteur fixe (= celle de la pastille) pour que toutes les cartes alignent
       leur métrique, qu'elles aient un badge ou non. */
    min-height: 20px;
  }
  /* En-tête (icône + titre) discret : la métrique chiffrée reste le point fort.
     L'opacité est posée sur l'icône et le titre — pas sur tout l'en-tête — pour
     laisser la pastille d'alerte à pleine intensité. */
  .icon {
    display: inline-flex;
    flex: 0 0 auto;
    line-height: 1;
    color: var(--ludo-color);
    opacity: 0.55;
  }
  .name {
    flex: 1;
    font-size: 0.6875rem;
    font-weight: var(--weight-medium);
    line-height: 1;
    color: var(--text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--warning-light);
    color: var(--warning);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    line-height: 1;
  }

  .metric {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .num {
    font-size: var(--text-display, 2rem);
    font-weight: var(--weight-bold);
    line-height: 1;
    color: var(--text-main);
    font-variant-numeric: tabular-nums;
  }
  .unit {
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: var(--text-muted);
  }

  .hint {
    font-size: var(--text-small);
    color: var(--text-subtle);
  }
</style>
