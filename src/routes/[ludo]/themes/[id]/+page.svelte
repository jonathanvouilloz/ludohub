<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Table from '$lib/components/ui/table/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import ThemeItemList from '$lib/components/themes/ThemeItemList.svelte'
  import ThemeImageGallery from '$lib/components/themes/ThemeImageGallery.svelte'
  import LoanDialog from '$lib/components/themes/LoanDialog.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'

  let { data, form } = $props()

  const theme = $derived(data.theme)
  const editable = $derived(!theme.isArchived)
  const activeLoan = $derived((theme.loans ?? []).find((l) => l.status === 'actif'))
  const pendingRequests = $derived((theme.loans ?? []).filter((l) => l.status === 'en_attente'))
  // L'historique exclut les demandes en attente (affichées dans leur section dédiée).
  const history = $derived((theme.loans ?? []).filter((l) => l.status !== 'en_attente'))

  let loanOpen = $state(false)

  const statusLabels: Record<string, string> = {
    actif: 'En prêt',
    retourne: 'Retourné',
    annule: 'Annulé',
  }
</script>

<svelte:head>
  <title>{theme.name} — {data.ludo.name}</title>
</svelte:head>

<main class="theme">
  <header class="head">
    <div>
      <a class="back" href="/{data.ludo.slug}/themes">← Thèmes</a>
      <h1>
        {theme.name}
        {#if theme.isArchived}<Badge variant="secondary">Archivé</Badge>{/if}
        {#if theme.isShareable}<Badge variant="outline">Partagé</Badge>{/if}
      </h1>
    </div>
    <div class="head-actions">
      {#if editable && !activeLoan}
        <Button onclick={() => (loanOpen = true)}>Prêter</Button>
      {/if}
      <form method="POST" action="?/archive" use:enhance>
        <input type="hidden" name="archived" value={theme.isArchived ? 'false' : 'true'} />
        <Button type="submit" variant="outline">
          {theme.isArchived ? 'Désarchiver' : 'Archiver'}
        </Button>
      </form>
    </div>
  </header>

  {#if form?.error}
    <p class="banner" role="alert">{form.error}</p>
  {/if}

  {#if pendingRequests.length > 0}
    <section class="requests">
      <h2>Demandes d'emprunt en attente</h2>
      {#each pendingRequests as req (req.id)}
        <div class="request">
          <div>
            <span class="request-head">
              <strong>{req.toLudo?.name ?? '—'}</strong>
              <span class="pending-pill">En attente</span>
            </span>
            <span class="muted"> · {formatDateShort(req.createdAt)}</span>
            {#if req.notes}<p class="note">{req.notes}</p>{/if}
          </div>
          <div class="request-actions">
            <form method="POST" action="?/confirmRequest" use:enhance>
              <input type="hidden" name="loanId" value={req.id} />
              <Button type="submit" size="sm" disabled={!!activeLoan}>Accepter</Button>
            </form>
            <form method="POST" action="?/declineRequest" use:enhance>
              <input type="hidden" name="loanId" value={req.id} />
              <Button type="submit" variant="outline" size="sm">Refuser</Button>
            </form>
          </div>
        </div>
      {/each}
    </section>
  {/if}

  {#if activeLoan}
    <section class="loan-active">
      <div>
        <strong>En prêt</strong> à {activeLoan.toLudo?.name ?? '—'}
        depuis le {formatDateShort(activeLoan.createdAt)}
        {#if activeLoan.notes}<span class="muted"> · {activeLoan.notes}</span>{/if}
      </div>
      <form method="POST" action="?/returnLoan" use:enhance>
        <input type="hidden" name="loanId" value={activeLoan.id} />
        <Button type="submit" variant="outline" size="sm">Marquer comme retourné</Button>
      </form>
    </section>
  {/if}

  <div class="columns">
    <section class="col">
      <h2>Détails</h2>
      {#if editable}
        <form method="POST" action="?/update" use:enhance class="edit">
          <div class="field">
            <Label for="name">Nom</Label>
            <Input id="name" name="name" value={theme.name} required />
          </div>
          <div class="field">
            <Label for="description">Description</Label>
            <textarea id="description" name="description" rows="3"
              >{theme.description ?? ''}</textarea
            >
          </div>
          <Button type="submit" size="sm">Enregistrer</Button>
        </form>

        <form method="POST" action="?/toggleShareable" use:enhance class="share">
          <input type="hidden" name="shareable" value={theme.isShareable ? 'false' : 'true'} />
          <Button type="submit" variant="ghost" size="sm">
            {theme.isShareable ? 'Retirer du catalogue réseau' : 'Partager dans le réseau'}
          </Button>
        </form>
      {:else}
        <p class="muted">{theme.description || 'Aucune description.'}</p>
      {/if}

      <h2>Items</h2>
      <ThemeItemList items={theme.items ?? []} {editable} />
    </section>

    <section class="col">
      <h2>Photos</h2>
      <ThemeImageGallery themeId={theme.id} images={theme.images ?? []} {editable} />

      <h2>Historique des prêts</h2>
      {#if history.length === 0}
        <p class="muted">Aucun prêt enregistré.</p>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Ludothèque</Table.Head>
              <Table.Head>Date</Table.Head>
              <Table.Head>Statut</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each history as loan (loan.id)}
              <Table.Row>
                <Table.Cell>{loan.toLudo?.name ?? '—'}</Table.Cell>
                <Table.Cell>{formatDateShort(loan.createdAt)}</Table.Cell>
                <Table.Cell>
                  {#if loan.status === 'actif'}
                    <Badge variant="secondary">{statusLabels[loan.status]}</Badge>
                  {:else}
                    <Badge variant="outline">{statusLabels[loan.status] ?? loan.status}</Badge>
                  {/if}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </section>
  </div>

  <LoanDialog bind:open={loanOpen} themeId={theme.id} ludos={data.ludos} />
</main>

<style>
  .theme {
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
    flex-wrap: wrap;
  }
  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
  }
  h1 {
    color: var(--text-main);
    margin: var(--space-2) 0 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-body);
    margin: var(--space-6) 0 var(--space-3);
  }
  .col h2:first-child {
    margin-top: 0;
  }
  .head-actions {
    display: flex;
    gap: var(--space-3);
  }
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
  .loan-active {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-6);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    flex-wrap: wrap;
  }
  .requests {
    margin-bottom: var(--space-6);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .requests h2 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-body);
    color: var(--text-main);
  }
  .request {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) 0;
    flex-wrap: wrap;
  }
  .request + .request {
    border-top: 1px solid var(--border);
  }
  .request-head {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .pending-pill {
    display: inline-flex;
    align-items: center;
    height: 1.25rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--warning-light);
    color: var(--warning);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  .request-actions {
    display: flex;
    gap: var(--space-2);
  }
  .note {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-8);
  }
  @media (max-width: 720px) {
    .columns {
      grid-template-columns: 1fr;
      gap: var(--space-4);
    }
  }
  .col {
    min-width: 0;
  }
  .edit,
  .share {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
  }
  .share {
    margin-top: var(--space-2);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }
  textarea {
    font: inherit;
    color: var(--text-main);
    background: var(--bg-input, var(--bg-card));
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    resize: vertical;
  }
  textarea:focus-visible {
    outline: 2px solid var(--ring, var(--ludo-color));
    outline-offset: 1px;
  }
  .muted {
    color: var(--text-muted);
  }
</style>
