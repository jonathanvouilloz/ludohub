<script lang="ts">
  import ActivityDialog from '$lib/components/public-site/ActivityDialog.svelte'
  import EditorialListItem from '$lib/components/public-site/EditorialListItem.svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import CalendarIcon from '@lucide/svelte/icons/calendar-days'
  import PlusIcon from '@lucide/svelte/icons/plus'
  let { data } = $props()
  let dialogOpen = $state(false)
  let filter = $state<'all' | 'published' | 'draft' | 'hidden' | 'archived'>('all')
  const base = $derived(`/${data.ludo.slug}/site-public/activites`)
  const filtered = $derived(
    filter === 'all'
      ? data.activities
      : filter === 'archived'
        ? data.activities.filter((item) => item.lifecycle !== 'active')
        : data.activities.filter((item) => item.status === filter && item.lifecycle === 'active'),
  )
  function status(item: (typeof data.activities)[number]) {
    if (item.lifecycle === 'trashed') return 'Corbeille'
    if (item.lifecycle === 'archived') return 'Archivée'
    return item.status === 'published'
      ? 'Publiée'
      : item.status === 'hidden'
        ? 'Masquée'
        : 'Brouillon'
  }
  function variant(item: (typeof data.activities)[number]): 'success' | 'secondary' | 'warning' {
    if (item.lifecycle === 'trashed') return 'warning'
    return item.status === 'published' && item.lifecycle === 'active' ? 'success' : 'secondary'
  }
  function rhythm(item: (typeof data.activities)[number]) {
    return item.type === 'one_off' ? 'Ponctuelle' : item.type === 'recurring' ? 'Récurrente' : 'Permanente'
  }
  function targets(item: (typeof data.activities)[number]) {
    return item.targets.length === 0
      ? 'Tous les lieux actifs'
      : item.targets.map((target) => target.site.name).join(', ')
  }
</script>

<svelte:head><title>Activités · {data.ludo.name}</title></svelte:head>
<main class="index-page">
  <header>
    <div>
      <h1>Activités</h1>
      <p>
        Gérez le contenu, le rythme et la publication de chaque activité.
      </p>
    </div>
    <Button onclick={() => (dialogOpen = true)}
      ><PlusIcon size={16} aria-hidden="true" /> Nouvelle activité</Button
    >
  </header>
  {#if data.activities.length === 0}<EmptyState
      icon={CalendarIcon}
      title="Aucune activité"
      description="Créez une première activité. Elle restera en brouillon jusqu’à sa publication."
      >{#snippet action()}<Button onclick={() => (dialogOpen = true)}>Créer une activité</Button
        >{/snippet}</EmptyState
    >{:else}
    <div class="filters" role="group" aria-label="Filtrer les activités">
      <button class:active={filter === 'all'} onclick={() => (filter = 'all')}>Toutes</button
      ><button class:active={filter === 'published'} onclick={() => (filter = 'published')}
        >Publiées</button
      ><button class:active={filter === 'draft'} onclick={() => (filter = 'draft')}
        >Brouillons</button
      ><button class:active={filter === 'hidden'} onclick={() => (filter = 'hidden')}
        >Masquées</button
      ><button class:active={filter === 'archived'} onclick={() => (filter = 'archived')}
        >Archives</button
      >
    </div>
    {#if filtered.length === 0}<p class="no-result">
        Aucune activité dans cette catégorie.
      </p>{:else}<div class="content-list">
        {#each filtered as item (item.id)}<EditorialListItem
            href={`${base}/${item.id}`}
            title={item.title}
            description={item.summary}
            meta={[rhythm(item), targets(item), ...(item.location ? [item.location] : [])]}
            status={status(item)}
            statusVariant={variant(item)}
            warning={item.targets.some((target) => !target.site.isActive)
              ? 'Cette activité concerne un lieu inactif.'
              : null}
            imageUrl={item.imageUrl}
            imageAlt={item.imageAlt ?? ''}
          />{/each}
      </div>{/if}
  {/if}
  <ActivityDialog bind:open={dialogOpen} activity={null} />
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
    header :global(button) {
      width: 100%;
    }
  }
</style>
