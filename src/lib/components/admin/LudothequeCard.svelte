<script lang="ts">
  import * as Table from '$lib/components/ui/table/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { formatDateShort } from '$lib/utils/dates.js'

  type LudothequeRowData = {
    id: string
    name: string
    slug: string
    color: string
    address: string | null
    createdAt: Date | string
  }

  let { ludo }: { ludo: LudothequeRowData } = $props()
</script>

<Table.Row>
  <Table.Cell class="name-cell">{ludo.name}</Table.Cell>
  <Table.Cell><code>{ludo.slug}</code></Table.Cell>
  <Table.Cell>
    <span class="color-cell">
      <span class="swatch" style="background:{ludo.color}"></span>
      <code>{ludo.color}</code>
    </span>
  </Table.Cell>
  <Table.Cell>{ludo.address ?? '—'}</Table.Cell>
  <Table.Cell>{formatDateShort(ludo.createdAt)}</Table.Cell>
  <Table.Cell class="actions-col">
    <Button variant="ghost" size="sm" href={`/admin/ludotheques/${ludo.id}`}>Gérer</Button>
  </Table.Cell>
</Table.Row>

<style>
  .color-cell {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .swatch {
    width: 16px;
    height: 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
  }
</style>
