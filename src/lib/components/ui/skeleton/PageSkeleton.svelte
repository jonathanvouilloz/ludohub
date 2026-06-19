<script lang="ts">
  import Skeleton from './Skeleton.svelte'
  import SkeletonCard from './SkeletonCard.svelte'

  /** Placeholder de page (titre + grille de cartes) affiché pendant une
   *  navigation client vers une page lourde. */
  let { cards = 6 }: { cards?: number } = $props()
</script>

<div class="page-skeleton" role="status" aria-label="Chargement…">
  <div class="head">
    <Skeleton width="220px" height="1.75rem" />
    <Skeleton width="320px" height="0.9rem" />
  </div>
  <div class="grid">
    {#each Array(cards) as _, i (i)}
      <SkeletonCard />
    {/each}
  </div>
</div>

<style>
  .page-skeleton {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-8);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-4);
  }
</style>
