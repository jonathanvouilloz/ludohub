<script lang="ts">
  import GuideSection from '$lib/aide/GuideSection.svelte'
  import { sections, docsVersion } from '$lib/aide/content'
</script>

<svelte:head>
  <title>Aide</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="aide">
  <header class="head">
    <h1>Aide</h1>
    <p class="muted">Retrouvez ici comment utiliser chaque partie de l'application.</p>
  </header>

  <nav class="toc" aria-label="Sommaire">
    <ol>
      {#each sections as section (section.id)}
        <li><a href="#{section.id}">{section.title}</a></li>
      {/each}
    </ol>
  </nav>

  {#each sections as section (section.id)}
    <GuideSection {section} version={docsVersion} />
  {/each}
</main>

<style>
  .aide {
    max-inline-size: 860px;
  }
  .head {
    margin-block-end: var(--space-6);
  }
  .head h1 {
    font-size: var(--text-display);
    font-weight: var(--weight-bold);
    color: var(--text-main);
    margin: 0;
  }
  .muted {
    color: var(--text-muted);
    margin: var(--space-1) 0 0;
  }
  .toc {
    margin-block-end: var(--space-10);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .toc ol {
    margin: 0;
    padding-inline-start: var(--space-5);
  }
  .toc a {
    color: var(--ludo-color);
    text-decoration: none;
  }
  .toc a:hover {
    text-decoration: underline;
  }
</style>
