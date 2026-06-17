<script lang="ts">
  import * as Table from '$lib/components/ui/table/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let { data } = $props()

  // Résolution id → nom de ludothèque pour l'affichage.
  const ludoNames = $derived(new Map(data.ludos.map((l) => [l.id, l.name])))

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

<svelte:head>
  <title>Journal d'activité — Administration</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="head">
  <a class="back" href="/admin">← Administration</a>
  <h1>Journal d'activité</h1>
  <p class="muted">
    {data.logs.length} entrée(s) — {data.logs.length === 200
      ? 'limité aux 200 plus récentes'
      : 'toutes affichées'}.
  </p>
</header>

<form method="GET" class="filters">
  <div class="field">
    <Label for="filter-ludo">Ludothèque</Label>
    <select id="filter-ludo" name="ludoId" value={data.filters.ludoId}>
      <option value="">Toutes</option>
      {#each data.ludos as ludo (ludo.id)}
        <option value={ludo.id}>{ludo.name}</option>
      {/each}
    </select>
  </div>

  <div class="field">
    <Label for="filter-action">Action</Label>
    <Input
      id="filter-action"
      name="action"
      value={data.filters.action}
      placeholder="ex. theme.loaned"
    />
  </div>

  <div class="filter-actions">
    <Button type="submit">Filtrer</Button>
    <Button type="button" variant="ghost" href="/admin/logs">Réinitialiser</Button>
  </div>
</form>

{#if data.logs.length === 0}
  <p class="empty">Aucune activité ne correspond à ces filtres.</p>
{:else}
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Date</Table.Head>
        <Table.Head>Ludothèque</Table.Head>
        <Table.Head>Action</Table.Head>
        <Table.Head>Entité</Table.Head>
        <Table.Head>Métadonnées</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each data.logs as log (log.id)}
        <Table.Row>
          <Table.Cell>{formatDateTime(log.createdAt)}</Table.Cell>
          <Table.Cell>{ludoNames.get(log.ludoId) ?? '—'}</Table.Cell>
          <Table.Cell><Badge variant="secondary">{log.action}</Badge></Table.Cell>
          <Table.Cell>{log.entityType}</Table.Cell>
          <Table.Cell class="meta-cell"><code>{summarizeMetadata(log.metadata)}</code></Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}

<style>
  .head {
    margin-bottom: var(--space-6);
  }
  .back {
    display: inline-block;
    margin-bottom: var(--space-2);
    font-size: var(--text-small);
    color: var(--text-muted);
    text-decoration: none;
  }
  .back:hover {
    color: var(--text-main);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
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
</style>
