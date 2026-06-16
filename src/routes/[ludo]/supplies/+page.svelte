<script lang="ts">
  import * as Table from '$lib/components/ui/table/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import SupplyRequestRow from '$lib/components/supplies/SupplyRequestRow.svelte'
  import NewSupplyDialog from '$lib/components/supplies/NewSupplyDialog.svelte'
  import type { SupplyRequestRow as SupplyRow, MemberRow } from '$lib/server/schema'

  type SupplyWithMember = SupplyRow & { member?: MemberRow | null }

  let { data, form } = $props()

  let newOpen = $state(false)

  const supplies = $derived(data.supplies as SupplyWithMember[])
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
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Nom</Table.Head>
          <Table.Head>Catégorie</Table.Head>
          <Table.Head>Urgence</Table.Head>
          <Table.Head>Statut</Table.Head>
          <Table.Head>Demandé par</Table.Head>
          <Table.Head class="actions-col">Actions</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each supplies as supply (supply.id)}
          <SupplyRequestRow
            {supply}
            responsable={data.responsable}
            currentMemberId={data.currentMemberId}
          />
        {/each}
      </Table.Body>
    </Table.Root>
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
  :global(.actions-col) {
    text-align: right;
  }
</style>
