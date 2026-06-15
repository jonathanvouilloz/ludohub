<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import PlanningGrid from '$lib/components/planning/PlanningGrid.svelte'
  import MySchedule from '$lib/components/planning/MySchedule.svelte'

  let { data } = $props()
</script>

<svelte:head>
  <title>Planning — {data.activeSeason?.name ?? 'LudoHub'}</title>
</svelte:head>

<main class="planning">
  <header class="head">
    <div>
      <h1>Planning</h1>
      {#if data.activeSeason}
        <p class="muted">Saison active : {data.activeSeason.name}</p>
      {:else}
        <p class="muted">Aucune saison active.</p>
      {/if}
    </div>
    {#if data.responsable}
      <Button href="/{data.ludo.slug}/planning/saisons" variant="outline">Gérer les saisons</Button>
    {/if}
  </header>

  {#if data.activeSeason}
    {#if data.responsable}
      <div class="manage-link">
        <a href="/{data.ludo.slug}/planning/saisons/{data.activeSeason.id}">
          Éditer cette saison →
        </a>
      </div>
    {/if}
    <PlanningGrid slots={data.slots} readOnly />
  {:else if data.responsable}
    <p class="muted">Créez une saison pour générer les samedis.</p>
  {:else}
    <p class="muted">Aucune saison n'est ouverte pour le moment.</p>
  {/if}

  <section class="mine">
    <h2>Mes prochains samedis</h2>
    <MySchedule upcoming={data.upcoming} />
  </section>
</main>

<style>
  .planning {
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
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  h2 {
    color: var(--text-main);
    margin: 0 0 var(--space-4);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .mine {
    margin-top: var(--space-10);
  }
  .manage-link {
    margin-bottom: var(--space-4);
  }
  .manage-link a {
    color: var(--ludo-color);
    font-weight: var(--weight-medium);
    text-decoration: none;
  }
  .manage-link a:hover {
    text-decoration: underline;
  }
</style>
