<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import HelpRequestCard from './HelpRequestCard.svelte'

  type CardRequest = ComponentProps<typeof HelpRequestCard>['request']

  let { requests, readonly = false }: { requests: CardRequest[]; readonly?: boolean } = $props()
</script>

{#if requests.length === 0}
  <p class="empty">Aucune demande pour le moment.</p>
{:else}
  <div class="feed">
    {#each requests as request (request.id)}
      <HelpRequestCard {request} {readonly} />
    {/each}
  </div>
{/if}

<style>
  .feed {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: var(--space-4);
  }
  .empty {
    color: var(--text-subtle);
    font-style: italic;
  }
</style>
