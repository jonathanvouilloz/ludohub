<script lang="ts">
  import * as Table from '$lib/components/ui/table/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import { formatDateShort } from '$lib/utils/dates.js'

  type CheckupItem = { status: 'present' | 'a_reparer' | 'manquant' }
  type Checkup = {
    id: string
    checkedAt: Date | string
    notes: string | null
    checkedBy: { name: string } | null
    items: CheckupItem[]
  }

  let { checkups = [] }: { checkups?: Checkup[] } = $props()

  function toRepair(c: Checkup): number {
    return c.items.filter((i) => i.status === 'a_reparer').length
  }
  function missing(c: Checkup): number {
    return c.items.filter((i) => i.status === 'manquant').length
  }
  function present(c: Checkup): number {
    return c.items.filter((i) => i.status === 'present').length
  }
</script>

{#if checkups.length === 0}
  <p class="muted">Aucun check-up enregistré.</p>
{:else}
  <DataTable>
    {#snippet head()}
      <Table.Row>
        <Table.Head>Date</Table.Head>
        <Table.Head>Par</Table.Head>
        <Table.Head>Présents</Table.Head>
        <Table.Head>À réparer</Table.Head>
        <Table.Head>Manquants</Table.Head>
      </Table.Row>
    {/snippet}
    {#snippet body()}
      {#each checkups as c (c.id)}
        <Table.Row>
          <Table.Cell>{formatDateShort(c.checkedAt)}</Table.Cell>
          <Table.Cell>{c.checkedBy?.name ?? '—'}</Table.Cell>
          <Table.Cell>{present(c)}</Table.Cell>
          <Table.Cell>
            {#if toRepair(c) > 0}
              <Badge variant="warning">{toRepair(c)}</Badge>
            {:else}
              <span class="muted">0</span>
            {/if}
          </Table.Cell>
          <Table.Cell>
            {#if missing(c) > 0}
              <Badge variant="destructive">{missing(c)}</Badge>
            {:else}
              <span class="muted">0</span>
            {/if}
          </Table.Cell>
        </Table.Row>
        {#if c.notes}
          <Table.Row>
            <Table.Cell colspan={5}>
              <span class="note">{c.notes}</span>
            </Table.Cell>
          </Table.Row>
        {/if}
      {/each}
    {/snippet}
    {#snippet cards()}
      {#each checkups as c (c.id)}
        {#snippet cardNote()}{c.notes}{/snippet}
        <DataCard title={formatDateShort(c.checkedAt)} notes={c.notes ? cardNote : undefined}>
          {#snippet badge()}
            {#if toRepair(c) > 0}
              <Badge variant="warning">{toRepair(c)} à réparer</Badge>
            {/if}
            {#if missing(c) > 0}
              <Badge variant="destructive">{missing(c)} manquant{missing(c) > 1 ? 's' : ''}</Badge>
            {/if}
          {/snippet}
          {#snippet byline()}
            Par {c.checkedBy?.name ?? '—'} · {present(c)} présent{present(c) > 1 ? 's' : ''}
          {/snippet}
        </DataCard>
      {/each}
    {/snippet}
  </DataTable>
{/if}

<style>
  .muted {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .note {
    color: var(--text-muted);
    font-size: var(--text-small);
    font-style: italic;
  }
</style>
