<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as Table from '$lib/components/ui/table/index.js'

  let {
    head,
    body,
    cards,
    class: className = '',
  }: {
    head: Snippet
    body: Snippet
    cards?: Snippet
    class?: string
  } = $props()
</script>

<div class="dt-surface dt-table {className}">
  <Table.Root>
    <Table.Header>
      {@render head()}
    </Table.Header>
    <Table.Body>
      {@render body()}
    </Table.Body>
  </Table.Root>
</div>

{#if cards}
  <div class="dt-cards">
    {@render cards()}
  </div>
{/if}

<style>
  .dt-surface {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  /* En-tête : surface légèrement teintée + texte discret. */
  .dt-surface :global(thead) {
    background: var(--bg-sidebar);
  }
  .dt-surface :global(thead th) {
    color: var(--text-muted);
    font-weight: var(--weight-semibold);
  }
  /* Lignes : séparateur fin, survol doux, dernière ligne sans bordure. */
  .dt-surface :global(tbody tr) {
    border-color: var(--border);
  }
  .dt-surface :global(tbody tr:hover) {
    background: var(--bg-hover);
  }
  .dt-surface :global(tbody tr:last-child) {
    border-bottom: 0;
  }

  /* Représentation mobile : cartes empilées (rendu via le snippet `cards`). */
  .dt-cards {
    display: none;
  }

  @media (max-width: 639px) {
    .dt-table {
      display: none;
    }
    .dt-cards {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
  }
</style>
