<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Table from '$lib/components/ui/table/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { formatDateShort, formatDayWeekday } from '$lib/utils/dates.js'
  import type { AttendanceRow } from '$lib/server/schema'

  let { records, onEdit }: { records: AttendanceRow[]; onEdit: (record: AttendanceRow) => void } =
    $props()

  const periodLabels: Record<string, string> = {
    matin: 'Matin',
    apres_midi: 'Après-midi',
    evenement: 'Événement',
  }
  const weatherLabels: Record<string, string> = {
    beau: 'Beau',
    gris: 'Gris',
    pluie: 'Pluie',
    neige: 'Neige',
  }

  function periodText(r: AttendanceRow): string {
    const base = periodLabels[r.period] ?? r.period
    return r.period === 'evenement' && r.eventLabel ? `${base} · ${r.eventLabel}` : base
  }

  function weatherText(r: AttendanceRow): string {
    if (!r.weather) return '—'
    const label = weatherLabels[r.weather] ?? r.weather
    return r.temperature != null ? `${label}, ${r.temperature}°C` : label
  }
</script>

{#snippet rowActions(r: AttendanceRow)}
  <Button variant="ghost" size="icon-sm" title="Corriger" onclick={() => onEdit(r)}>
    <PencilIcon aria-hidden="true" />
    <span class="sr-only">Corriger</span>
  </Button>
  <AlertDialog.Root>
    <AlertDialog.Trigger
      class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
      title="Supprimer"
    >
      <Trash2Icon class="danger-icon" aria-hidden="true" />
      <span class="sr-only">Supprimer</span>
    </AlertDialog.Trigger>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Supprimer cette ouverture ?</AlertDialog.Title>
        <AlertDialog.Description>
          L'ouverture du {formatDateShort(r.date)} ({periodLabels[r.period] ?? r.period}) sera
          définitivement supprimée.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <form
        method="POST"
        action="?/delete"
        use:enhance={toastEnhance({ success: 'Ouverture supprimée.' })}
      >
        <input type="hidden" name="id" value={r.id} />
        <AlertDialog.Footer>
          <AlertDialog.Cancel type="button">Retour</AlertDialog.Cancel>
          <button type="submit" class={buttonVariants({ variant: 'destructive' })}>Supprimer</button
          >
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/snippet}

<DataTable>
  {#snippet head()}
    <Table.Row>
      <Table.Head>Date</Table.Head>
      <Table.Head>Période</Table.Head>
      <Table.Head class="num">Adultes</Table.Head>
      <Table.Head class="num">Enfants</Table.Head>
      <Table.Head class="num">Prêts</Table.Head>
      <Table.Head class="num">Retours</Table.Head>
      <Table.Head>Météo</Table.Head>
      <Table.Head class="actions-col">Actions</Table.Head>
    </Table.Row>
  {/snippet}
  {#snippet body()}
    {#each records as r (r.id)}
      <Table.Row>
        <Table.Cell>{formatDateShort(r.date)}</Table.Cell>
        <Table.Cell>{periodText(r)}</Table.Cell>
        <Table.Cell class="num">{r.adultsCount}</Table.Cell>
        <Table.Cell class="num">{r.childrenCount}</Table.Cell>
        <Table.Cell class="num">{r.loansCount}</Table.Cell>
        <Table.Cell class="num">{r.returnsCount}</Table.Cell>
        <Table.Cell class="muted">{weatherText(r)}</Table.Cell>
        <Table.Cell>
          <div class="actions">{@render rowActions(r)}</div>
        </Table.Cell>
      </Table.Row>
    {/each}
  {/snippet}
  {#snippet cards()}
    {#each records as r (r.id)}
      {#snippet counts()}
        <ul class="card-counts">
          <li><span>Adultes</span><strong>{r.adultsCount}</strong></li>
          <li><span>Enfants</span><strong>{r.childrenCount}</strong></li>
          <li><span>Prêts</span><strong>{r.loansCount}</strong></li>
          <li><span>Retours</span><strong>{r.returnsCount}</strong></li>
        </ul>
      {/snippet}
      <DataCard title={formatDayWeekday(r.date)} spacedFooter notes={counts}>
        {#snippet byline()}{periodText(r)} · {weatherText(r)}{/snippet}
        {#snippet actions()}{@render rowActions(r)}{/snippet}
      </DataCard>
    {/each}
  {/snippet}
</DataTable>

<style>
  .actions {
    display: flex;
    gap: var(--space-1);
    justify-content: flex-end;
  }
  .actions :global(form) {
    display: inline;
  }
  :global(.actions-col) {
    text-align: right;
  }
  :global(.num) {
    text-align: right;
  }
  .card-counts {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2) var(--space-4);
  }
  .card-counts li {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .card-counts strong {
    color: var(--text-main);
  }
</style>
