<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Table from '$lib/components/ui/table/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { StatusBadge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import XIcon from '@lucide/svelte/icons/x'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import ListIcon from '@lucide/svelte/icons/list'
  import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days'
  import NewAbsenceDialog from '$lib/components/absences/NewAbsenceDialog.svelte'
  import AbsenceReviewDialog from '$lib/components/absences/AbsenceReviewDialog.svelte'
  import AbsenceCalendar from '$lib/components/absences/AbsenceCalendar.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { AbsenceRow, MemberRow } from '$lib/server/schema'

  type AbsenceWithMember = AbsenceRow & { member?: MemberRow | null }

  let { data, form } = $props()

  let newOpen = $state(false)
  let reviewOpen = $state(false)
  let reviewing = $state<AbsenceWithMember | null>(null)

  let viewMode = $state<'table' | 'calendar'>('table')
  let selectedMemberId = $state('all')

  const typeLabels: Record<string, string> = {
    conge: 'Congé',
    vacances: 'Vacances',
    formation: 'Formation',
    indisponible: 'Indisponible',
  }

  const absences = $derived(data.absences as AbsenceWithMember[])
  const pending = $derived(absences.filter((a) => a.status === 'en_attente'))

  // Filtre par membre (responsable) puis tri par date de début croissante.
  const filtered = $derived(
    absences.filter((a) => selectedMemberId === 'all' || a.memberId === selectedMemberId),
  )
  const tableRows = $derived([...filtered].sort((a, b) => a.startDate.localeCompare(b.startDate)))
  const memberFilterLabel = $derived(
    selectedMemberId === 'all'
      ? 'Tous les membres'
      : (data.members.find((m) => m.id === selectedMemberId)?.name ?? 'Tous les membres'),
  )

  function openReview(absence: AbsenceWithMember) {
    reviewing = absence
    reviewOpen = true
  }
</script>

<svelte:head>
  <title>Absences — {data.ludo.name}</title>
</svelte:head>

<main class="absences">
  <header class="head">
    <div>
      <h1>Absences</h1>
      <p class="muted">
        {data.responsable ? "Demandes d'absence de l'équipe." : "Vos demandes d'absence."}
      </p>
    </div>
    <Button onclick={() => (newOpen = true)}>
      {data.responsable ? 'Planifier une absence' : 'Nouvelle demande'}
    </Button>
  </header>

  {#if form?.error}
    <p class="banner" role="alert">{form.error}</p>
  {/if}

  {#if data.responsable && pending.length > 0}
    <section class="pending">
      <h2>À traiter ({pending.length})</h2>
      <ul>
        {#each pending as a (a.id)}
          <li>
            <div class="pending-info">
              <strong>{a.member?.name ?? '—'}</strong>
              <span class="muted">
                {typeLabels[a.type] ?? a.type} · {formatDateShort(a.startDate)} → {formatDateShort(
                  a.endDate,
                )}
              </span>
            </div>
            <Button size="sm" onclick={() => openReview(a)}>Examiner</Button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#snippet rowActions(a: AbsenceWithMember)}
    {#if data.responsable && a.status === 'en_attente'}
      <Button variant="ghost" size="icon-sm" title="Examiner" onclick={() => openReview(a)}>
        <EyeIcon aria-hidden="true" />
        <span class="sr-only">Examiner</span>
      </Button>
    {/if}
    {#if data.responsable}
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
            <AlertDialog.Title>Supprimer cette absence ?</AlertDialog.Title>
            <AlertDialog.Description>
              L'absence de {a.member?.name ?? 'ce membre'} sera définitivement supprimée.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <form method="POST" action="?/deleteAbsence" use:enhance>
            <input type="hidden" name="id" value={a.id} />
            <AlertDialog.Footer>
              <AlertDialog.Cancel type="button">Retour</AlertDialog.Cancel>
              <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
                Supprimer
              </button>
            </AlertDialog.Footer>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {/if}
    {#if !data.responsable && a.status === 'en_attente'}
      <AlertDialog.Root>
        <AlertDialog.Trigger
          class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          title="Annuler"
        >
          <XIcon aria-hidden="true" />
          <span class="sr-only">Annuler</span>
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Annuler cette demande d'absence ?</AlertDialog.Title>
            <AlertDialog.Description>
              La demande sera supprimée. Vous pourrez en refaire une si besoin.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <form method="POST" action="?/cancel" use:enhance>
            <input type="hidden" name="id" value={a.id} />
            <AlertDialog.Footer>
              <AlertDialog.Cancel type="button">Retour</AlertDialog.Cancel>
              <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
                Annuler la demande
              </button>
            </AlertDialog.Footer>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {/if}
  {/snippet}

  {#snippet memberFilter()}
    {#if data.responsable && data.members.length > 0}
      <div class="member-filter">
        <Select.Root type="single" bind:value={selectedMemberId}>
          <Select.Trigger aria-label="Filtrer par membre">{memberFilterLabel}</Select.Trigger>
          <Select.Content>
            <Select.Item value="all" label="Tous les membres" />
            {#each data.members as m (m.id)}
              <Select.Item value={m.id} label={m.name} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    {/if}
  {/snippet}

  <div class="toolbar">
    <div class="segmented" role="group" aria-label="Vue">
      <button
        type="button"
        class:active={viewMode === 'table'}
        aria-pressed={viewMode === 'table'}
        onclick={() => (viewMode = 'table')}
      >
        <ListIcon aria-hidden="true" />
        Tableau
      </button>
      <button
        type="button"
        class:active={viewMode === 'calendar'}
        aria-pressed={viewMode === 'calendar'}
        onclick={() => (viewMode = 'calendar')}
      >
        <CalendarDaysIcon aria-hidden="true" />
        Calendrier
      </button>
    </div>

    {#if viewMode === 'table'}
      {@render memberFilter()}
    {/if}
  </div>

  {#if viewMode === 'calendar'}
    <AbsenceCalendar
      absences={filtered}
      slug={data.ludo.slug}
      filter={data.responsable && data.members.length > 0 ? memberFilter : undefined}
    />
  {:else if tableRows.length === 0}
    <p class="empty">
      {selectedMemberId === 'all'
        ? 'Aucune demande pour le moment.'
        : 'Aucune absence pour ce membre.'}
    </p>
  {:else}
    <DataTable>
      {#snippet head()}
        <Table.Row>
          <Table.Head>Membre</Table.Head>
          <Table.Head>Type</Table.Head>
          <Table.Head>Période</Table.Head>
          <Table.Head>Statut</Table.Head>
          <Table.Head>Note</Table.Head>
          <Table.Head class="actions-col">Actions</Table.Head>
        </Table.Row>
      {/snippet}
      {#snippet body()}
        {#each tableRows as a (a.id)}
          <Table.Row>
            <Table.Cell>{a.member?.name ?? '—'}</Table.Cell>
            <Table.Cell>{typeLabels[a.type] ?? a.type}</Table.Cell>
            <Table.Cell>{formatDateShort(a.startDate)} → {formatDateShort(a.endDate)}</Table.Cell>
            <Table.Cell><StatusBadge status={a.status} /></Table.Cell>
            <Table.Cell class="note-cell">{a.responderNotes ?? a.notes ?? ''}</Table.Cell>
            <Table.Cell>
              <div class="actions">{@render rowActions(a)}</div>
            </Table.Cell>
          </Table.Row>
        {/each}
      {/snippet}
      {#snippet cards()}
        {#each tableRows as a (a.id)}
          {#snippet cardNote()}{a.responderNotes ?? a.notes}{/snippet}
          <DataCard
            title={a.member?.name ?? '—'}
            notes={(a.responderNotes ?? a.notes) ? cardNote : undefined}
          >
            {#snippet badge()}<StatusBadge status={a.status} />{/snippet}
            {#snippet byline()}
              {typeLabels[a.type] ?? a.type} · {formatDateShort(a.startDate)} → {formatDateShort(
                a.endDate,
              )}
            {/snippet}
            {#snippet actions()}{@render rowActions(a)}{/snippet}
          </DataCard>
        {/each}
      {/snippet}
    </DataTable>
  {/if}

  <NewAbsenceDialog bind:open={newOpen} responsable={data.responsable} members={data.members} />
  <AbsenceReviewDialog bind:open={reviewOpen} absence={reviewing} />
</main>

<style>
  .absences {
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
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-semibold);
    margin: 0 0 var(--space-3);
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
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-bottom: var(--space-4);
  }
  .segmented {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-card);
  }
  .segmented button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out-strong),
      color var(--dur-fast) var(--ease-out-strong);
  }
  .segmented button + button {
    border-left: 1px solid var(--border);
  }
  .segmented button :global(svg) {
    width: 1rem;
    height: 1rem;
  }
  .segmented button:hover {
    background: var(--bg-hover);
  }
  .segmented button.active {
    background: var(--ludo-color, var(--text-main));
    color: var(--text-inverse);
  }
  .member-filter {
    min-width: 12rem;
  }
  .pending {
    margin-bottom: var(--space-6);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .pending ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .pending li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  .pending-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .pending-info .muted {
    font-size: var(--text-small);
  }
  .actions {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .actions form {
    display: inline;
  }
  :global(.actions-col) {
    text-align: right;
  }
  :global(.note-cell) {
    color: var(--text-muted);
    font-size: var(--text-small);
    max-width: 16rem;
  }
</style>
