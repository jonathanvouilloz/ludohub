<script lang="ts">
  import { replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import { Button } from '$lib/components/ui/button/index.js'
  import { CollapsibleSection } from '$lib/components/ui/collapsible-section/index.js'
  import SupplyCard from '$lib/components/supplies/SupplyCard.svelte'
  import NewSupplyDialog from '$lib/components/supplies/NewSupplyDialog.svelte'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import PackageIcon from '@lucide/svelte/icons/package'
  import type { SupplyRequestRow as SupplyRow, MemberRow } from '$lib/server/schema'

  type SupplyWithMember = SupplyRow & { member?: MemberRow | null }

  let { data, form } = $props()

  let newOpen = $state(false)

  // Ouverture directe du dialog depuis une action rapide de l'accueil (`?new=1`),
  // puis on nettoie l'URL pour ne pas le rouvrir au rechargement.
  $effect(() => {
    if (page.url.searchParams.get('new') === '1') {
      newOpen = true
      const url = new URL(page.url.href)
      url.searchParams.delete('new')
      replaceState(url, {})
    }
  })

  // Les demandes arrivent déjà triées par urgence décroissante (service).
  const supplies = $derived(data.supplies as SupplyWithMember[])
  // Les reçus sont rangés dans une section repliée — la liste principale ne montre que l'actif.
  const pending = $derived(supplies.filter((s) => s.status !== 'recu'))
  const received = $derived(supplies.filter((s) => s.status === 'recu'))

  const urgencyFilters = [
    { key: 'all', label: 'Tout' },
    { key: 'critique', label: 'Critique' },
    { key: 'haute', label: 'Haute' },
    { key: 'normale', label: 'Normale' },
  ] as const

  let activeUrgency = $state<string>('all')

  function countFor(key: string): number {
    return key === 'all' ? pending.length : pending.filter((s) => s.urgency === key).length
  }

  const filtered = $derived(
    activeUrgency === 'all' ? pending : pending.filter((s) => s.urgency === activeUrgency),
  )
</script>

<svelte:head>
  <title>Matériel — {data.ludo.name}</title>
</svelte:head>

<main class="supplies">
  <header class="head">
    <div>
      <h1>Matériel</h1>
      <p class="muted">Les demandes de matériel et de fournitures de la ludothèque.</p>
    </div>
    <Button onclick={() => (newOpen = true)}>Nouvelle demande</Button>
  </header>

  {#if form?.error}
    <p class="banner" role="alert">{form.error}</p>
  {/if}

  {#if supplies.length === 0}
    <EmptyState
      icon={PackageIcon}
      title="Aucune demande pour le moment"
      description="Créez une demande pour signaler un besoin de matériel."
    >
      {#snippet action()}
        <Button onclick={() => (newOpen = true)}>Nouvelle demande</Button>
      {/snippet}
    </EmptyState>
  {:else}
    {#if pending.length > 0}
      <div class="tabs" role="tablist" aria-label="Filtrer par urgence">
        {#each urgencyFilters as f (f.key)}
          <button
            type="button"
            role="tab"
            aria-selected={activeUrgency === f.key}
            class="tab urgency-{f.key}"
            class:active={activeUrgency === f.key}
            onclick={() => (activeUrgency = f.key)}
          >
            {f.label}
            <span class="badge-count">{countFor(f.key)}</span>
          </button>
        {/each}
      </div>

      {#if filtered.length === 0}
        <EmptyState icon={PackageIcon} title="Aucune demande pour cette urgence" compact />
      {:else}
        <div class="list">
          {#each filtered as supply (supply.id)}
            <SupplyCard
              {supply}
              responsable={data.responsable}
              currentMemberId={data.currentMemberId}
            />
          {/each}
        </div>
      {/if}
    {:else}
      <EmptyState icon={PackageIcon} title="Aucune demande en attente" compact />
    {/if}

    {#if received.length > 0}
      <CollapsibleSection title="Reçus" count={received.length}>
        <div class="list">
          {#each received as supply (supply.id)}
            <SupplyCard
              {supply}
              responsable={data.responsable}
              currentMemberId={data.currentMemberId}
            />
          {/each}
        </div>
      </CollapsibleSection>
    {/if}
  {/if}

  <NewSupplyDialog bind:open={newOpen} />
</main>

<style>
  .supplies {
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
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
  .tabs {
    display: flex;
    gap: var(--space-1);
    overflow-x: auto;
    margin-bottom: var(--space-5);
    padding-bottom: var(--space-1);
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-card);
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out-strong),
      color var(--dur-fast) var(--ease-out-strong),
      border-color var(--dur-fast) var(--ease-out-strong);
  }
  .tab:hover {
    background: var(--bg-hover);
  }
  .tab.active {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--text-inverse);
  }
  /* Filtres color-codés par sévérité quand actifs (« Tout » reste primary). */
  .tab.urgency-critique.active {
    background: var(--danger);
    border-color: var(--danger);
  }
  .tab.urgency-haute.active {
    background: var(--warning);
    border-color: var(--warning);
  }
  .tab.urgency-normale.active {
    background: var(--text-subtle);
    border-color: var(--text-subtle);
  }
  .badge-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    padding: 0 var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--bg-base);
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
  }
  .tab.active .badge-count {
    background: var(--bg-card);
    color: var(--text-main);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
