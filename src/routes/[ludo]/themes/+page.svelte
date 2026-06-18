<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import ThemeCard from '$lib/components/themes/ThemeCard.svelte'
  import ActiveThemeCard from '$lib/components/themes/ActiveThemeCard.svelte'

  let { data } = $props()

  const themes = $derived(data.themes)
  const activeThemes = $derived(themes.filter((t) => (t.installations?.length ?? 0) > 0))
  const restThemes = $derived(themes.filter((t) => !(t.installations?.length ?? 0)))
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
      <Button href="/{data.ludo.slug}/themes/new">Nouveau thème</Button>
    </div>
  </header>

  {#if themes.length === 0}
    <p class="empty">Aucun thème pour le moment. Créez-en un pour démarrer le catalogue.</p>
  {:else}
    {#if activeThemes.length > 0}
      <section class="active-section">
        <h2 class="section-title">
          Thème{activeThemes.length > 1 ? 's' : ''} actif{activeThemes.length > 1 ? 's' : ''}
        </h2>
        <div class="active-list">
          {#each activeThemes as theme (theme.id)}
            <ActiveThemeCard {theme} slug={data.ludo.slug} />
          {/each}
        </div>
      </section>
    {/if}

    {#if restThemes.length > 0}
      <div class="grid">
        {#each restThemes as theme (theme.id)}
          <ThemeCard {theme} slug={data.ludo.slug} />
        {/each}
      </div>
    {/if}
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
  .active-section {
    margin-bottom: var(--space-8);
  }
  .section-title {
    margin: 0 0 var(--space-3);
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }
  .active-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: var(--space-4);
  }
</style>
