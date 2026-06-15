<script lang="ts">
  import { formatDateCH } from '$lib/utils/dates.js'

  type UpcomingSlot = { slotId: string; date: string; seasonName: string }

  let { upcoming }: { upcoming: UpcomingSlot[] } = $props()
</script>

{#if upcoming.length === 0}
  <p class="muted">Vous n'avez aucun samedi à venir pour le moment.</p>
{:else}
  <ul class="schedule">
    {#each upcoming as item (item.slotId)}
      <li>
        <span class="date">{formatDateCH(item.date)}</span>
        <span class="season">{item.seasonName}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .muted {
    color: var(--text-muted);
  }
  .schedule {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .schedule li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .date {
    color: var(--text-main);
    font-weight: var(--weight-medium);
    text-transform: capitalize;
  }
  .season {
    font-size: var(--text-small);
    color: var(--text-muted);
  }
</style>
