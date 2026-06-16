<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Table from '$lib/components/ui/table/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import NewAbsenceDialog from '$lib/components/absences/NewAbsenceDialog.svelte'
  import AbsenceReviewDialog from '$lib/components/absences/AbsenceReviewDialog.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { AbsenceRow, MemberRow } from '$lib/server/schema'

  type AbsenceWithMember = AbsenceRow & { member?: MemberRow | null }

  let { data, form } = $props()

  let newOpen = $state(false)
  let reviewOpen = $state(false)
  let reviewing = $state<AbsenceWithMember | null>(null)

  const typeLabels: Record<string, string> = {
    conge: 'Congé',
    vacances: 'Vacances',
    formation: 'Formation',
    indisponible: 'Indisponible',
  }

  const absences = $derived(data.absences as AbsenceWithMember[])
  const pending = $derived(absences.filter((a) => a.status === 'en_attente'))

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
    <Button onclick={() => (newOpen = true)}>Nouvelle demande</Button>
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

  {#if absences.length === 0}
    <p class="empty">Aucune demande pour le moment.</p>
  {:else}
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#if data.responsable}<Table.Head>Membre</Table.Head>{/if}
          <Table.Head>Type</Table.Head>
          <Table.Head>Période</Table.Head>
          <Table.Head>Statut</Table.Head>
          <Table.Head>Note</Table.Head>
          <Table.Head class="actions-col">Actions</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each absences as a (a.id)}
          <Table.Row>
            {#if data.responsable}<Table.Cell>{a.member?.name ?? '—'}</Table.Cell>{/if}
            <Table.Cell>{typeLabels[a.type] ?? a.type}</Table.Cell>
            <Table.Cell>{formatDateShort(a.startDate)} → {formatDateShort(a.endDate)}</Table.Cell>
            <Table.Cell>
              {#if a.status === 'approuve'}
                <Badge>Approuvée</Badge>
              {:else if a.status === 'refuse'}
                <Badge variant="destructive">Refusée</Badge>
              {:else}
                <Badge variant="outline">En attente</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell class="note-cell">{a.responderNotes ?? a.notes ?? ''}</Table.Cell>
            <Table.Cell>
              <div class="actions">
                {#if data.responsable && a.status === 'en_attente'}
                  <Button variant="ghost" size="sm" onclick={() => openReview(a)}>Examiner</Button>
                {/if}
                {#if !data.responsable && a.status === 'en_attente'}
                  <form method="POST" action="?/cancel" use:enhance>
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" variant="ghost" size="sm">Annuler</Button>
                  </form>
                {/if}
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}

  <NewAbsenceDialog bind:open={newOpen} />
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
    font-size: var(--text-body);
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
