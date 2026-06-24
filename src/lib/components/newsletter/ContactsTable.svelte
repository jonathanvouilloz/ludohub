<script lang="ts">
  import type { Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import { page as pageState } from '$app/state'
  import {
    createTable,
    getCoreRowModel,
    type ColumnDef,
    type SortingState,
  } from '@tanstack/table-core'
  import * as Table from '$lib/components/ui/table/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import { StatusBadge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import ChevronUpIcon from '@lucide/svelte/icons/chevron-up'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
  import { TAG_LABELS, TAG_VARIANTS } from '$lib/newsletter/tags'
  import type { NewsletterContactRow } from '$lib/server/schema'

  let {
    contacts,
    sort,
    page,
    pageCount,
    rowActions,
  }: {
    contacts: NewsletterContactRow[]
    sort: { col: string; dir: string }
    page: number
    pageCount: number
    rowActions: Snippet<[NewsletterContactRow]>
  } = $props()

  const STATUS_LABELS: Record<string, string> = {
    subscribed: 'Abonné',
    unsubscribed: 'Désabonné',
    bounced: 'Rejeté',
  }
  const STATUS_VARIANTS = {
    subscribed: 'success',
    unsubscribed: 'secondary',
    bounced: 'destructive',
  } as const
  const SOURCE_LABELS: Record<string, string> = { manual: 'Ajout manuel', import: 'Import' }

  function fullName(c: NewsletterContactRow): string {
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—'
  }

  // Colonnes TanStack. Seules celles triables côté serveur ont `enableSorting`.
  const columns: ColumnDef<NewsletterContactRow>[] = [
    { id: 'email', accessorKey: 'email', header: 'Email' },
    { id: 'name', header: 'Nom', enableSorting: false },
    { id: 'tag', accessorKey: 'tag', header: 'Segment' },
    { id: 'status', accessorKey: 'status', header: 'Statut' },
    { id: 'source', accessorKey: 'source', header: 'Source', enableSorting: false },
    { id: 'actions', header: '', enableSorting: false },
  ]

  // État de tri reflétant la vérité serveur (le tri lui-même est fait par la DB).
  const sorting = $derived<SortingState>([{ id: sort.col, desc: sort.dir === 'desc' }])

  // Le table-core est recréé quand les entrées changent : modèles toujours frais,
  // sans gestion d'effet/cycle de vie (liste paginée à 50 lignes, coût négligeable).
  const table = $derived(
    createTable<NewsletterContactRow>({
      data: contacts,
      columns,
      // `columnPinning` doit être initialisé : `getHeaderGroups()` lit `state…
      // .columnPinning.left` et planterait (SSR 500) dès qu'il y a des lignes à
      // rendre si on ne fournit qu'un état partiel. Le tri reste purement serveur.
      state: { sorting, columnPinning: { left: [], right: [] } },
      manualSorting: true,
      manualPagination: true,
      pageCount,
      getCoreRowModel: getCoreRowModel(),
      onSortingChange: () => {},
      onStateChange: () => {},
      renderFallbackValue: null,
    }),
  )

  /** Navigue vers le serveur avec de nouveaux paramètres (re-`load`). */
  function navigate(params: Record<string, string>) {
    const search = new URLSearchParams(pageState.url.searchParams)
    for (const [k, v] of Object.entries(params)) search.set(k, v)
    goto(`?${search}`, { keepFocus: true, noScroll: true })
  }

  function toggleSort(colId: string) {
    const nextDir = sort.col === colId && sort.dir === 'asc' ? 'desc' : 'asc'
    navigate({ sort: colId, dir: nextDir, page: '1' })
  }

  function gotoPage(p: number) {
    navigate({ page: String(p) })
  }
</script>

<DataTable>
  {#snippet head()}
    {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
      <Table.Row>
        {#each headerGroup.headers as header (header.id)}
          <Table.Head class={header.column.id === 'actions' ? 'actions-col' : undefined}>
            {#if header.column.getCanSort()}
              <button class="sort-btn" type="button" onclick={() => toggleSort(header.column.id)}>
                {header.column.columnDef.header}
                {#if sort.col === header.column.id}
                  {#if sort.dir === 'asc'}
                    <ChevronUpIcon size={14} aria-hidden="true" />
                  {:else}
                    <ChevronDownIcon size={14} aria-hidden="true" />
                  {/if}
                {:else}
                  <ChevronsUpDownIcon size={14} class="sort-idle" aria-hidden="true" />
                {/if}
              </button>
            {:else}
              {header.column.columnDef.header}
            {/if}
          </Table.Head>
        {/each}
      </Table.Row>
    {/each}
  {/snippet}

  {#snippet body()}
    {#each table.getRowModel().rows as row (row.id)}
      {@const c = row.original}
      <Table.Row>
        {#each row.getVisibleCells() as cell (cell.id)}
          <Table.Cell class={cell.column.id === 'actions' ? 'actions-col' : undefined}>
            {#if cell.column.id === 'email'}
              {c.email}
            {:else if cell.column.id === 'name'}
              {fullName(c)}
            {:else if cell.column.id === 'tag'}
              {#if c.tag}
                <StatusBadge status={c.tag} labels={TAG_LABELS} variantMap={TAG_VARIANTS} />
              {:else}
                <span class="muted-cell">—</span>
              {/if}
            {:else if cell.column.id === 'status'}
              <StatusBadge status={c.status} labels={STATUS_LABELS} variantMap={STATUS_VARIANTS} />
            {:else if cell.column.id === 'source'}
              <span class="muted-cell">{SOURCE_LABELS[c.source] ?? c.source}</span>
            {:else if cell.column.id === 'actions'}
              <div class="actions">{@render rowActions(c)}</div>
            {/if}
          </Table.Cell>
        {/each}
      </Table.Row>
    {/each}
  {/snippet}

  {#snippet cards()}
    {#each contacts as c (c.id)}
      <DataCard title={c.email}>
        {#snippet badge()}
          <StatusBadge status={c.status} labels={STATUS_LABELS} variantMap={STATUS_VARIANTS} />
        {/snippet}
        {#snippet byline()}{fullName(c)} · {SOURCE_LABELS[c.source] ?? c.source}{c.tag
            ? ` · ${TAG_LABELS[c.tag]}`
            : ''}{/snippet}
        {#snippet actions()}{@render rowActions(c)}{/snippet}
      </DataCard>
    {/each}
  {/snippet}
</DataTable>

{#if pageCount > 1}
  <nav class="pager" aria-label="Pagination">
    <Button variant="outline" size="sm" disabled={page <= 1} onclick={() => gotoPage(page - 1)}>
      Précédent
    </Button>
    <span class="pager-info">Page {page} / {pageCount}</span>
    <Button
      variant="outline"
      size="sm"
      disabled={page >= pageCount}
      onclick={() => gotoPage(page + 1)}
    >
      Suivant
    </Button>
  </nav>
{/if}

<style>
  .sort-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .sort-btn :global(.sort-idle) {
    opacity: 0.4;
  }
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
  :global(.muted-cell) {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }
  .pager-info {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
</style>
