<script lang="ts">
  import * as Table from '$lib/components/ui/table/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'

  type LogRow = {
    id: string
    createdAt: Date | string
    ludoId: string
    action: string
    entityType: string
    metadata: unknown
  }
  type LudoOption = { id: string; name: string }
  type LogFilters = { ludoId: string; action: string }

  let { logs, ludos, filters }: { logs: LogRow[]; ludos: LudoOption[]; filters: LogFilters } =
    $props()

  // Résolution id → nom de ludothèque pour l'affichage.
  const ludoNames = $derived(new Map(ludos.map((l) => [l.id, l.name])))

  function formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function summarizeMetadata(metadata: unknown): string {
    if (metadata == null) return '—'
    try {
      return JSON.stringify(metadata)
    } catch {
      return '—'
    }
  }
</script>

<form method="GET" class="filters">
  <div class="field">
    <Label for="filter-ludo">Ludothèque</Label>
    <select id="filter-ludo" name="ludoId" value={filters.ludoId}>
      <option value="">Toutes</option>
      {#each ludos as ludo (ludo.id)}
        <option value={ludo.id}>{ludo.name}</option>
      {/each}
    </select>
  </div>

  <div class="field">
    <Label for="filter-action">Action</Label>
    <Input id="filter-action" name="action" value={filters.action} placeholder="ex. theme.loaned" />
  </div>

  <div class="filter-actions">
    <Button type="submit">Filtrer</Button>
    <Button type="button" variant="ghost" href="/admin/logs">Réinitialiser</Button>
  </div>
</form>

{#if logs.length === 0}
  <p class="empty">Aucune activité ne correspond à ces filtres.</p>
{:else}
  <DataTable>
    {#snippet head()}
      <Table.Row>
        <Table.Head>Date</Table.Head>
        <Table.Head>Ludothèque</Table.Head>
        <Table.Head>Action</Table.Head>
        <Table.Head>Entité</Table.Head>
        <Table.Head>Métadonnées</Table.Head>
      </Table.Row>
    {/snippet}
    {#snippet body()}
      {#each logs as log (log.id)}
        <Table.Row>
          <Table.Cell>{formatDateTime(log.createdAt)}</Table.Cell>
          <Table.Cell>{ludoNames.get(log.ludoId) ?? '—'}</Table.Cell>
          <Table.Cell><Badge variant="secondary">{log.action}</Badge></Table.Cell>
          <Table.Cell>{log.entityType}</Table.Cell>
          <Table.Cell class="meta-cell"><code>{summarizeMetadata(log.metadata)}</code></Table.Cell>
        </Table.Row>
      {/each}
    {/snippet}
    {#snippet cards()}
      {#each logs as log (log.id)}
        {#snippet cardNote()}<code class="meta">{summarizeMetadata(log.metadata)}</code>{/snippet}
        <DataCard title={ludoNames.get(log.ludoId) ?? '—'} notes={cardNote}>
          {#snippet badge()}<Badge variant="secondary">{log.action}</Badge>{/snippet}
          {#snippet byline()}{formatDateTime(log.createdAt)} · {log.entityType}{/snippet}
        </DataCard>
      {/each}
    {/snippet}
  </DataTable>
{/if}

<style>
  .filters {
    display: flex;
    align-items: flex-end;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-bottom: var(--space-6);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .field select {
    height: 38px;
    padding: 0 var(--space-3);
    font-size: var(--text-body);
    color: var(--text-main);
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
  }
  .filter-actions {
    display: flex;
    gap: var(--space-2);
  }
  .empty {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-muted);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  :global(.meta-cell code) {
    display: inline-block;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  code.meta {
    display: block;
    overflow-wrap: anywhere;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
</style>
