<script lang="ts">
  import EditorialListItem from '$lib/components/public-site/EditorialListItem.svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import NewspaperIcon from '@lucide/svelte/icons/newspaper'
  import PlusIcon from '@lucide/svelte/icons/plus'

  let { data } = $props()
  let filter = $state<'all' | 'published' | 'draft' | 'hidden'>('all')
  const filteredNews = $derived(
    filter === 'all' ? data.news : data.news.filter((item) => item.status === filter),
  )
  const base = $derived(`/${data.ludo.slug}/site-public/actualites`)
  function statusLabel(status: string) {
    return status === 'published' ? 'Publiée' : status === 'hidden' ? 'Masquée' : 'Brouillon'
  }
  function statusVariant(status: string): 'success' | 'secondary' {
    return status === 'published' ? 'success' : 'secondary'
  }
  function targetLabel(item: (typeof data.news)[number]) {
    return item.targets.length === 0
      ? 'Tous les lieux actifs'
      : item.targets.map((target) => target.site.name).join(', ')
  }
</script>

<svelte:head><title>Actualités · {data.ludo.name}</title></svelte:head>
<main class="index-page">
  <header>
    <div>
      <h1>Actualités</h1>
      <p>
        Créez ou modifiez une actualité, puis choisissez simplement si elle est visible sur le site.
      </p>
    </div>
    <Button href={`${base}/nouveau`}
      ><PlusIcon size={16} aria-hidden="true" /> Nouvelle actualité</Button
    >
  </header>

  {#if data.news.length === 0}
    <EmptyState
      icon={NewspaperIcon}
      title="Aucune actualité"
      description="Créez une première actualité : elle peut être visible tout de suite ou rester cachée."
      >{#snippet action()}<Button href={`${base}/nouveau`}>Créer une actualité</Button
        >{/snippet}</EmptyState
    >
  {:else}
    <div class="filters" role="group" aria-label="Filtrer les actualités">
      <button class:active={filter === 'all'} onclick={() => (filter = 'all')}
        >Toutes <span>{data.news.length}</span></button
      >
      <button class:active={filter === 'published'} onclick={() => (filter = 'published')}
        >Publiées <span>{data.news.filter((item) => item.status === 'published').length}</span
        ></button
      >
      <button class:active={filter === 'draft'} onclick={() => (filter = 'draft')}
        >Brouillons <span>{data.news.filter((item) => item.status === 'draft').length}</span
        ></button
      >
      <button class:active={filter === 'hidden'} onclick={() => (filter = 'hidden')}
        >Masquées <span>{data.news.filter((item) => item.status === 'hidden').length}</span></button
      >
    </div>
    {#if filteredNews.length === 0}<p class="no-result">
        Aucune actualité dans cette catégorie.
      </p>{:else}<div class="content-list">
        {#each filteredNews as item (item.id)}<EditorialListItem
            href={`${base}/${item.id}/modifier`}
            title={item.title}
            description={item.summary}
            meta={[targetLabel(item), `Adresse : /${item.slug}`]}
            status={statusLabel(item.status)}
            statusVariant={statusVariant(item.status)}
            warning={item.targets.some((target) => !target.site.isActive)
              ? 'Cette actualité concerne un lieu inactif.'
              : null}
            imageUrl={item.imageUrl}
            imageAlt={item.imageAlt ?? ''}
          />{/each}
      </div>{/if}
  {/if}
</main>

<style>
  .index-page {
    display: grid;
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-4) var(--space-6) var(--space-12);
    gap: var(--space-5);
  }
  header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-5);
  }
  h1,
  p {
    margin: 0;
  }
  h1 {
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  header p {
    max-width: 680px;
    margin-top: var(--space-2);
    color: var(--text-muted);
    line-height: 1.5;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .filters button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }
  .filters button.active {
    border-color: var(--primary);
    background: var(--primary-light);
    color: var(--primary-dark);
  }
  .filters button:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .filters span {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .content-list {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  .no-result {
    padding: var(--space-8);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    color: var(--text-muted);
    text-align: center;
  }
  @media (max-width: 640px) {
    .index-page {
      padding: var(--space-3) var(--space-4) var(--space-10);
    }
    header {
      align-items: stretch;
      flex-direction: column;
    }
    header :global(a) {
      width: 100%;
    }
    .filters {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .filters button {
      justify-content: center;
    }
  }
</style>
