<script lang="ts">
  import type { Component } from 'svelte'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'

  let {
    href,
    icon: Icon,
    label,
    full = false,
  }: {
    href: string
    icon: Component
    label: string
    /** Carte pleine largeur, icône à gauche + chevron (sinon : tuile icône en haut). */
    full?: boolean
  } = $props()
</script>

<a {href} class="action" class:full>
  <span class="icon" aria-hidden="true"><Icon size={22} /></span>
  <span class="label">{label}</span>
  {#if full}
    <ChevronRightIcon size={20} class="chevron" aria-hidden="true" />
  {/if}
</a>

<style>
  .action {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    color: var(--text-main);
    text-decoration: none;
    transition:
      border-color var(--dur-fast) var(--ease-out-strong),
      transform var(--dur-fast) var(--ease-out-strong);
  }
  .action:hover {
    border-color: var(--ludo-color);
    transform: translateY(-2px);
  }
  .action:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--ludo-color) 12%, transparent);
    color: var(--ludo-color);
  }
  .label {
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
    line-height: var(--leading-tight);
  }

  /* Variante pleine largeur : icône à gauche, label, chevron à droite. */
  .action.full {
    flex-direction: row;
    align-items: center;
    gap: var(--space-4);
  }
  .action.full .label {
    flex: 1;
  }
  .action :global(.chevron) {
    flex: 0 0 auto;
    color: var(--text-subtle);
  }
</style>
