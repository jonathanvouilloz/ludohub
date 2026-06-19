<script lang="ts">
  import Skeleton from './Skeleton.svelte'

  /** Placeholder de carte (look DataCard) pendant un chargement de liste. */
  let { lines = 2 }: { lines?: number } = $props()
</script>

<div class="skeleton-card" aria-hidden="true">
  <Skeleton width="60%" height="1.1rem" />
  {#each Array(lines) as _, i (i)}
    <Skeleton width={i === lines - 1 ? '40%' : '90%'} height="0.8rem" />
  {/each}
</div>

<style>
  .skeleton-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
</style>
