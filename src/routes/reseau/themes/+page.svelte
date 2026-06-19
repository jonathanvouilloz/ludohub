<script lang="ts">
  import NetworkThemeCard from '$lib/components/themes/NetworkThemeCard.svelte'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import Share2Icon from '@lucide/svelte/icons/share-2'

  let { data } = $props()

  const themes = $derived(data.themes)
</script>

<svelte:head>
  <title>Catalogue réseau — Thèmes</title>
</svelte:head>

<main class="reseau">
  <header>
    <h1>Catalogue réseau</h1>
    <p class="muted">Les thèmes partagés par les autres ludothèques du réseau.</p>
  </header>

  {#if themes.length === 0}
    <EmptyState icon={Share2Icon} title="Aucun thème partagé pour le moment" />
  {:else}
    <div class="grid">
      {#each themes as theme (theme.id)}
        <NetworkThemeCard {theme} />
      {/each}
    </div>
  {/if}
</main>

<style>
  .reseau {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0 0 var(--space-6);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: var(--space-4);
  }
</style>
