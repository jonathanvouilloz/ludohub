<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js'
  import PlanningGrid from '$lib/components/planning/PlanningGrid.svelte'
  import ClosurePeriodsPanel from '$lib/components/planning/ClosurePeriodsPanel.svelte'
  import SeasonWizard from '$lib/components/planning/SeasonWizard.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'

  let { data } = $props()

  // Avant génération (aucune assignation) → wizard guidé
  // Après génération → grille de planification + fermetures éditables
  const showWizard = $derived(
    data.responsable && !data.season.isArchived && data.existingAssignmentsCount === 0,
  )
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

  {#if showWizard}
    <SeasonWizard
      season={data.season}
      closures={data.closures}
      members={data.members}
      memberSettings={data.memberSettings}
      seasonAbsences={data.seasonAbsences}
      workableSlotsCount={data.workableSlotsCount}
      permanentCount={data.permanentCount}
      poolCount={data.poolCount}
    />
  {:else}
    <PlanningGrid
      slots={data.slots}
      members={data.members}
      readOnly={data.season.isArchived || !data.responsable}
    />

    <ClosurePeriodsPanel
      closures={data.closures}
      seasonStartDate={data.season.startDate}
      readOnly={data.season.isArchived || !data.responsable}
    />
  {/if}
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
</style>
