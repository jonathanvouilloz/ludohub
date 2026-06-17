<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import PlanningTimeline from '$lib/components/planning/PlanningTimeline.svelte'

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
        <p class="muted">Saison {data.activeSeason.name}</p>
      {:else}
        <p class="muted">Aucune saison active.</p>
      {/if}
    </div>
    {#if data.responsable}
      <Button href="/{data.ludo.slug}/planning/saisons" variant="outline">Gérer les saisons</Button>
    {/if}
  </header>

  {#if data.activeSeason}
    <PlanningTimeline
      slots={data.slots}
      members={data.members}
      currentMemberId={data.currentMemberId}
      today={data.today}
      responsable={data.responsable}
    />
  {:else if data.responsable}
    <p class="muted">Créez une saison pour générer les samedis.</p>
  {:else}
    <p class="muted">Aucune saison n'est ouverte pour le moment.</p>
  {/if}
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
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
</style>
