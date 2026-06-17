<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import SupplyCard from '$lib/components/supplies/SupplyCard.svelte'
  import NewSupplyDialog from '$lib/components/supplies/NewSupplyDialog.svelte'
  import type { SupplyRequestRow as SupplyRow, MemberRow } from '$lib/server/schema'

  type SupplyWithMember = SupplyRow & { member?: MemberRow | null }

  let { data, form } = $props()

  let newOpen = $state(false)

  // Les demandes arrivent déjà triées par urgence décroissante (service).
  const supplies = $derived(data.supplies as SupplyWithMember[])

  const tabs = [
    { key: 'all', label: 'Tout' },
    { key: 'jeux', label: 'Jeux' },
    { key: 'materiel', label: 'Matériel' },
    { key: 'fournitures', label: 'Fournitures' },
    { key: 'autre', label: 'Autre' },
  ] as const

  let activeTab = $state<string>('all')

  function countFor(key: string): number {
    return key === 'all' ? supplies.length : supplies.filter((s) => s.category === key).length
  }

  const filtered = $derived(
    activeTab === 'all' ? supplies : supplies.filter((s) => s.category === activeTab),
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
    <p class="empty">Aucune demande pour le moment.</p>
  {:else}
    <div class="tabs" role="tablist" aria-label="Filtrer par catégorie">
      {#each tabs as tab (tab.key)}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          class="tab"
          class:active={activeTab === tab.key}
          onclick={() => (activeTab = tab.key)}
        >
          {tab.label}
          <span class="badge-count">{countFor(tab.key)}</span>
        </button>
      {/each}
    </div>

    {#if filtered.length === 0}
      <p class="empty">Aucune demande dans cette catégorie.</p>
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
  .empty {
    color: var(--text-subtle);
    font-style: italic;
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
    background: var(--primary-dark);
    color: var(--text-inverse);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
