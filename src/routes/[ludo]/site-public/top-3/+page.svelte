<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import ListOrderedIcon from '@lucide/svelte/icons/list-ordered'
  import HouseIcon from '@lucide/svelte/icons/house'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  const base = $derived(`/${data.ludo.slug}/site-public/top-3`)
</script>

<svelte:head><title>Top 3 · {data.ludo.name}</title></svelte:head>

<main class="top-three-page">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>Top 3</h1>
      <p class="intro">Trois jeux mis en avant autour d’un nom libre.</p>
    </div>
    <Button href={`${base}/nouveau`}>Nouveau Top 3</Button>
  </header>

  {#if page.form && 'error' in page.form && page.form.error}<p class="error" role="alert">
      {page.form.error}
    </p>{/if}

  {#if data.topThrees.length === 0}
    <EmptyState
      icon={ListOrderedIcon}
      title="Aucun Top 3"
      description="Créez une première sélection de trois jeux."
    >
      {#snippet action()}<Button href={`${base}/nouveau`}>Nouveau Top 3</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each data.topThrees as item (item.id)}
        <article class="card">
          <div class="card-head">
            <h2><a href={`${base}/${item.id}`}>{item.theme}</a></h2>
            {#if item.isHomepage}<Badge variant="default"
                ><HouseIcon size={14} aria-hidden="true" /> Sur l’accueil</Badge
              >{/if}
          </div>
          <ol>
            {#each item.games as game, index (index)}
              <li>
                {#if game.imageUrl}
                  <img src={game.imageUrl} alt={game.imageAlt ?? ''} />
                {:else}
                  <span class="thumb-empty" aria-hidden="true"></span>
                {/if}
                <strong>{game.name}</strong>
              </li>
            {/each}
          </ol>
          {#if item.status !== 'published'}
            <p class="notice">Pas encore en ligne : ouvrez-le et enregistrez-le pour le publier.</p>
          {/if}
          <footer>
            <Button href={`${base}/${item.id}`} variant="outline" size="sm"
              ><PencilIcon size={16} aria-hidden="true" /> Modifier</Button
            >
            <form
              method="POST"
              action="?/delete"
              onsubmit={(event) => {
                if (!confirm('Supprimer définitivement ce Top 3 ?')) event.preventDefault()
              }}
              use:enhance={toastEnhance({ success: 'Top 3 supprimé.' })}
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="revision" value={item.revision} />
              <Button type="submit" size="sm" variant="destructive">Supprimer</Button>
            </form>
          </footer>
        </article>
      {/each}
    </div>
  {/if}
</main>

<style>
  .top-three-page {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  .card-head,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  header {
    align-items: flex-end;
    margin-bottom: var(--space-6);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .eyebrow,
  .intro {
    color: var(--text-muted);
  }
  .eyebrow {
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h1 {
    margin-top: var(--space-1);
    font-size: var(--text-h1);
  }
  h2 {
    font-size: var(--text-card-title);
  }
  h2 a {
    color: var(--text-main);
    text-decoration: none;
  }
  h2 a:hover {
    color: var(--primary);
    text-decoration: underline;
  }
  .list {
    display: grid;
    gap: var(--space-4);
  }
  .card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  ol {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    gap: var(--space-2);
  }
  li img,
  .thumb-empty {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  .thumb-empty {
    display: block;
    border: 1px dashed var(--border-strong);
  }
  .notice,
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .notice {
    background: var(--warning-light);
  }
  .error {
    margin-bottom: var(--space-4);
    background: var(--danger-light);
    color: var(--danger);
  }
  footer {
    justify-content: flex-end;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  @media (max-width: 640px) {
    .top-three-page {
      padding: var(--space-6) var(--space-4);
    }
    header,
    .card-head {
      align-items: stretch;
      flex-direction: column;
    }
    header :global(a) {
      width: 100%;
    }
  }
</style>
