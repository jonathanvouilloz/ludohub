<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import ThemeCard from '$lib/components/themes/ThemeCard.svelte'

  let { data } = $props()

  const themes = $derived(data.themes)
</script>

<svelte:head>
  <title>Thèmes — {data.ludo.name}</title>
</svelte:head>

<main class="themes">
  <header class="head">
    <div>
      <h1>Thèmes</h1>
      <p class="muted">Le catalogue de thèmes de votre ludothèque.</p>
    </div>
    <div class="head-actions">
      <a class="link" href="/reseau/themes">Catalogue réseau →</a>
      <Button href="/{data.ludo.slug}/themes/new">Nouveau thème</Button>
    </div>
  </header>

  {#if themes.length === 0}
    <p class="empty">Aucun thème pour le moment. Créez-en un pour démarrer le catalogue.</p>
  {:else}
    <div class="grid">
      {#each themes as theme (theme.id)}
        <ThemeCard {theme} slug={data.ludo.slug} />
      {/each}
    </div>
  {/if}
</main>

<style>
  .themes {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .link {
    color: var(--ludo-color);
    font-weight: var(--weight-medium);
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
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
