<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import PlanningTable from '$lib/components/planning/PlanningTable.svelte'
  import { daysBetween, formatDayWeekday } from '$lib/utils/dates.js'

  let { data } = $props()

  // Bandeau « mon prochain samedi » (membre) : 1er samedi futur non
  // annulé/fermé où le membre courant est assigné.
  const myNext = $derived(
    data.slots.find(
      (s) =>
        s.date >= data.today &&
        !s.isCancelled &&
        !s.closure &&
        s.assignments.some((a) => a.member.id === data.currentMemberId),
    ),
  )
  const myNextLabel = $derived.by(() => {
    if (!myNext) return ''
    const n = daysBetween(data.today, myNext.date)
    if (n <= 0) return 'aujourd’hui'
    if (n === 1) return 'demain'
    return `dans ${n} jours`
  })
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
    {#if myNext}
      <div class="hero">
        <div class="hero-top">
          <span>Mon prochain samedi</span>
          <span class="hero-when">{myNextLabel}</span>
        </div>
        <strong class="hero-date">{formatDayWeekday(myNext.date)}</strong>
        <ul class="hero-members">
          {#each myNext.assignments as a (a.id)}
            <li class:me={a.member.id === data.currentMemberId}>{a.member.name}</li>
          {/each}
        </ul>
      </div>
    {/if}
    <PlanningTable
      slots={data.slots}
      members={data.members}
      today={data.today}
      currentMemberId={data.currentMemberId}
      readOnly={!data.responsable}
      canSwapOwn={!data.responsable}
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
  /* Hero « Mon prochain samedi » */
  .hero {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--ludo-color) 82%, white),
      var(--ludo-color) 45%,
      color-mix(in srgb, var(--ludo-color) 58%, black)
    );
    color: var(--text-inverse);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-6);
    margin-bottom: var(--space-6);
    box-shadow: var(--shadow-md);
  }
  .hero-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: var(--text-small);
    opacity: 0.9;
  }
  .hero-date {
    display: block;
    font-size: var(--text-display);
    line-height: var(--leading-tight);
    margin: var(--space-1) 0 var(--space-3);
    text-transform: capitalize;
  }
  .hero-members {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    font-size: var(--text-small);
  }
  .hero-members li {
    opacity: 0.85;
  }
  .hero-members li::before {
    content: '•';
    margin-right: var(--space-2);
  }
  .hero-members li.me {
    opacity: 1;
    font-weight: var(--weight-bold);
  }
</style>
