<script lang="ts">
  import NetworkThemeCard from '$lib/components/themes/NetworkThemeCard.svelte'

  let { data } = $props()

  const themes = $derived(data.themes)
</script>

<svelte:head>
  <title>Catalogue réseau — Thèmes</title>
</svelte:head>

<main class="reseau">
  <header>
    <a class="back" href="/{data.ludo.slug}/themes">← Mes thèmes</a>
    <h1>Catalogue réseau</h1>
    <p class="muted">Les thèmes partagés par les autres ludothèques du réseau.</p>
  </header>

  {#if themes.length === 0}
    <p class="empty">Aucun thème partagé pour le moment.</p>
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
  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
  }
  h1 {
    color: var(--text-main);
    margin: var(--space-2) 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0 0 var(--space-6);
  }
  .empty {
    color: var(--text-subtle);
    font-style: italic;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: var(--space-4);
  }
</style>
