<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import HelpRequestCard from './HelpRequestCard.svelte'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import InboxIcon from '@lucide/svelte/icons/inbox'

  type CardRequest = ComponentProps<typeof HelpRequestCard>['request']

  let { requests, readonly = false }: { requests: CardRequest[]; readonly?: boolean } = $props()
</script>

{#if requests.length === 0}
  <EmptyState icon={InboxIcon} title="Aucune demande pour le moment." />
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
</style>
