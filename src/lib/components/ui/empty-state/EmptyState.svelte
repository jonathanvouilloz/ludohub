<script lang="ts">
  import type { Component, Snippet } from 'svelte'

  let {
    icon,
    title,
    description,
    compact = false,
    action,
  }: {
    /** Composant icône lucide (ex. `InboxIcon`). */
    icon?: Component
    title: string
    description?: string
    /** Variante resserrée pour les petites zones (sous-listes filtrées). */
    compact?: boolean
    /** Action optionnelle (bouton, lien). */
    action?: Snippet
  } = $props()

  const Icon = $derived(icon)
</script>

<div class="empty-state" class:compact>
  {#if Icon}
    <span class="empty-icon" aria-hidden="true"><Icon size={compact ? 24 : 32} /></span>
  {/if}
  <p class="empty-title">{title}</p>
  {#if description}<p class="empty-desc">{description}</p>{/if}
  {#if action}<div class="empty-action">{@render action()}</div>{/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-10) var(--space-6);
    text-align: center;
  }
  .empty-state.compact {
    padding: var(--space-6) var(--space-4);
  }
  .empty-icon {
    display: inline-flex;
    color: var(--text-subtle);
    margin-bottom: var(--space-1);
  }
  .empty-title {
    margin: 0;
    color: var(--text-muted);
    font-weight: var(--weight-medium);
  }
  .empty-desc {
    margin: 0;
    max-width: 38ch;
    color: var(--text-subtle);
    font-size: var(--text-small);
  }
  .empty-action {
    margin-top: var(--space-3);
  }
</style>
