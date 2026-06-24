<script lang="ts">
  import * as Table from '$lib/components/ui/table/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import { formatDateShort } from '$lib/utils/dates.js'

  type CheckupItemStatus = 'present' | 'a_reparer' | 'manquant'
  type CheckupItem = {
    id: string
    status: CheckupItemStatus
    note: string | null
    installationItem: { themeItem: { name: string } | null } | null
  }
  type Checkup = {
    id: string
    checkedAt: Date | string
    notes: string | null
    checkedBy: { name: string } | null
    items: CheckupItem[]
  }

  let { checkups = [] }: { checkups?: Checkup[] } = $props()

  // Détail dépliable : un seul check-up ouvert à la fois.
  let selectedId = $state<string | null>(null)
  function toggle(id: string) {
    selectedId = selectedId === id ? null : id
  }

  const ITEM_STATUS: Record<
    CheckupItemStatus,
    { label: string; variant: 'success' | 'warning' | 'destructive' }
  > = {
    present: { label: 'Présent', variant: 'success' },
    a_reparer: { label: 'À réparer', variant: 'warning' },
    manquant: { label: 'Manquant', variant: 'destructive' },
  }
  function itemName(i: CheckupItem): string {
    return i.installationItem?.themeItem?.name ?? 'Élément supprimé'
  }

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

{#snippet detail(c: Checkup)}
  <ul class="detail-items">
    {#each c.items as item (item.id)}
      <li class="detail-item">
        <span class="detail-name">{itemName(item)}</span>
        <span class="detail-meta">
          {#if item.note}<span class="detail-item-note">{item.note}</span>{/if}
          <Badge variant={ITEM_STATUS[item.status].variant}>{ITEM_STATUS[item.status].label}</Badge>
        </span>
      </li>
    {/each}
  </ul>
  {#if c.notes}
    <p class="detail-note">{c.notes}</p>
  {/if}
{/snippet}

{#if checkups.length === 0}
  <p class="muted">Aucun check-up enregistré.</p>
{:else}
  <DataTable class="checkup-table">
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
        <Table.Row
          class="checkup-row"
          role="button"
          tabindex={0}
          aria-expanded={selectedId === c.id}
          onclick={() => toggle(c.id)}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggle(c.id)
            }
          }}
        >
          <Table.Cell>
            <span class="date-cell">
              <ChevronDownIcon
                class="row-chevron {selectedId === c.id ? '' : 'is-collapsed'}"
                size={16}
                aria-hidden="true"
              />
              {formatDateShort(c.checkedAt)}
            </span>
          </Table.Cell>
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
        {#if selectedId === c.id}
          <Table.Row>
            <Table.Cell colspan={5}>
              <div class="checkup-detail">{@render detail(c)}</div>
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
  /* Rendu « simple basique » : en-tête blanc uniforme.
     Surcharge le fond teinté du DataTable (spécificité ≥ via les 3 classes de surface). */
  :global(.dt-surface.dt-table.checkup-table thead) {
    background: var(--bg-card);
  }
  :global(.checkup-row) {
    cursor: pointer;
  }
  :global(.checkup-row:focus-visible) {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .date-cell {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  :global(.row-chevron) {
    flex-shrink: 0;
    color: var(--text-muted);
    transition: transform var(--dur-fast) var(--ease-out-strong);
  }
  :global(.row-chevron.is-collapsed) {
    transform: rotate(-90deg);
  }
  .checkup-detail {
    padding: var(--space-2) 0;
  }
  .detail-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .detail-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-1) 0;
  }
  .detail-item + .detail-item {
    border-top: 1px solid var(--border);
  }
  .detail-name {
    color: var(--text-main);
    font-size: var(--text-small);
  }
  .detail-meta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .detail-item-note {
    color: var(--text-muted);
    font-size: var(--text-small);
    font-style: italic;
  }
  .detail-note {
    margin: var(--space-3) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
    font-style: italic;
    overflow-wrap: anywhere;
  }
</style>
