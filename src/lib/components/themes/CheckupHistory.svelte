<script lang="ts">
  import * as Table from '$lib/components/ui/table/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { formatDateShort } from '$lib/utils/dates.js'

  type CheckupItem = { status: 'present' | 'manquant' }
  type Checkup = {
    id: string
    checkedAt: Date | string
    notes: string | null
    checkedBy: { name: string } | null
    items: CheckupItem[]
  }

  let { checkups = [] }: { checkups?: Checkup[] } = $props()

  function missing(c: Checkup): number {
    return c.items.filter((i) => i.status === 'manquant').length
  }
</script>

{#if checkups.length === 0}
  <p class="muted">Aucun check-up enregistré.</p>
{:else}
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Date</Table.Head>
        <Table.Head>Par</Table.Head>
        <Table.Head>Présents</Table.Head>
        <Table.Head>Manquants</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each checkups as c (c.id)}
        <Table.Row>
          <Table.Cell>{formatDateShort(c.checkedAt)}</Table.Cell>
          <Table.Cell>{c.checkedBy?.name ?? '—'}</Table.Cell>
          <Table.Cell>{c.items.length - missing(c)}</Table.Cell>
          <Table.Cell>
            {#if missing(c) > 0}
              <Badge variant="secondary">{missing(c)}</Badge>
            {:else}
              <span class="muted">0</span>
            {/if}
          </Table.Cell>
        </Table.Row>
        {#if c.notes}
          <Table.Row>
            <Table.Cell colspan={4}>
              <span class="note">{c.notes}</span>
            </Table.Cell>
          </Table.Row>
        {/if}
      {/each}
    </Table.Body>
  </Table.Root>
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
