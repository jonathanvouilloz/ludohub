<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js'
  import PlanningGrid from '$lib/components/planning/PlanningGrid.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'

  let { data, form } = $props()
</script>

<svelte:head>
  <title>{data.season.name} — {data.ludo.name}</title>
</svelte:head>

<main class="season">
  <div class="back">
    <a href="/{data.ludo.slug}/planning/saisons">← Saisons</a>
  </div>

  <header class="head">
    <div>
      <h1>{data.season.name}</h1>
      <p class="muted">
        {formatDateShort(data.season.startDate)} – {formatDateShort(data.season.endDate)}
      </p>
    </div>
    {#if data.season.isArchived}
      <Badge variant="destructive">Archivée — lecture seule</Badge>
    {/if}
  </header>

  {#if form?.error}
    <p class="banner" role="alert">{form.error}</p>
  {/if}

  <PlanningGrid
    slots={data.slots}
    members={data.members}
    readOnly={data.season.isArchived || !data.responsable}
  />
</main>

<style>
  .season {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .back {
    margin-bottom: var(--space-4);
  }
  .back a {
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
  }
  .back a:hover {
    color: var(--text-main);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
</style>
