<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Table from '$lib/components/ui/table/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { StatusBadge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import ContactDialog from '$lib/components/newsletter/ContactDialog.svelte'
  import UsersRoundIcon from '@lucide/svelte/icons/users-round'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import { TAG_LABELS, TAG_VARIANTS } from '$lib/newsletter/tags'
  import type { NewsletterContactRow } from '$lib/server/schema'

  let { data } = $props()

  const slug = $derived(data.ludo.slug)
  const contacts = $derived(data.contacts as NewsletterContactRow[])
  const subscribedCount = $derived(contacts.filter((c) => c.status === 'subscribed').length)

  let dialogOpen = $state(false)
  let editing = $state<NewsletterContactRow | null>(null)

  function openCreate() {
    editing = null
    dialogOpen = true
  }
  function openEdit(contact: NewsletterContactRow) {
    editing = contact
    dialogOpen = true
  }

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

  const byTag = $derived(data.subscribedByTag)
  // Résumé des segments abonnés (ex. « Famille 90 · Institution 8 · Non classé 3 »).
  const segmentSummary = $derived(
    [
      ...Object.entries(TAG_LABELS).map(([t, label]) => ({
        label,
        n: byTag[t as keyof typeof byTag] ?? 0,
      })),
      { label: 'Non classé', n: byTag.null },
    ].filter((s) => s.n > 0),
  )

  function fullName(c: NewsletterContactRow): string {
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—'
  }
</script>

<svelte:head>
  <title>Contacts — Newsletter — {data.ludo.name}</title>
</svelte:head>

<main class="contacts">
  <header class="head">
    <div>
      <h1>Contacts</h1>
      <p class="muted">
        Le public de votre ludothèque — {contacts.length}
        {contacts.length > 1 ? 'contacts' : 'contact'}, {subscribedCount} abonné{subscribedCount > 1
          ? 's'
          : ''}.
      </p>
      {#if segmentSummary.length > 0}
        <p class="segments">
          {#each segmentSummary as s, i (s.label)}{i > 0 ? ' · ' : ''}{s.label}
            <strong>{s.n}</strong>{/each}
        </p>
      {/if}
    </div>
    <div class="head-actions">
      <Button href={`/${slug}/newsletter/contacts/import`} variant="outline">
        <UploadIcon aria-hidden="true" />
        Importer
      </Button>
      <Button onclick={openCreate}>Ajouter un contact</Button>
    </div>
  </header>

  {#snippet rowActions(c: NewsletterContactRow)}
    <Button variant="ghost" size="icon-sm" title="Modifier" onclick={() => openEdit(c)}>
      <PencilIcon aria-hidden="true" />
      <span class="sr-only">Modifier</span>
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
          <AlertDialog.Title>Supprimer ce contact ?</AlertDialog.Title>
          <AlertDialog.Description>
            {c.email} sera définitivement retiré de votre liste.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <form
          method="POST"
          action="?/delete"
          use:enhance={toastEnhance({ success: 'Contact supprimé.' })}
        >
          <input type="hidden" name="id" value={c.id} />
          <AlertDialog.Footer>
            <AlertDialog.Cancel type="button">Retour</AlertDialog.Cancel>
            <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
              Supprimer
            </button>
          </AlertDialog.Footer>
        </form>
      </AlertDialog.Content>
    </AlertDialog.Root>
  {/snippet}

  {#if contacts.length === 0}
    <EmptyState
      icon={UsersRoundIcon}
      title="Aucun contact pour le moment"
      description="Ajoutez un contact manuellement ou importez une liste depuis un fichier CSV/Excel."
    >
      {#snippet action()}
        <Button onclick={openCreate}>Ajouter un contact</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <DataTable>
      {#snippet head()}
        <Table.Row>
          <Table.Head>Email</Table.Head>
          <Table.Head>Nom</Table.Head>
          <Table.Head>Segment</Table.Head>
          <Table.Head>Statut</Table.Head>
          <Table.Head>Source</Table.Head>
          <Table.Head class="actions-col">Actions</Table.Head>
        </Table.Row>
      {/snippet}
      {#snippet body()}
        {#each contacts as c (c.id)}
          <Table.Row>
            <Table.Cell>{c.email}</Table.Cell>
            <Table.Cell>{fullName(c)}</Table.Cell>
            <Table.Cell>
              {#if c.tag}
                <StatusBadge status={c.tag} labels={TAG_LABELS} variantMap={TAG_VARIANTS} />
              {:else}
                <span class="muted-cell">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <StatusBadge status={c.status} labels={STATUS_LABELS} variantMap={STATUS_VARIANTS} />
            </Table.Cell>
            <Table.Cell class="muted-cell">{SOURCE_LABELS[c.source] ?? c.source}</Table.Cell>
            <Table.Cell>
              <div class="actions">{@render rowActions(c)}</div>
            </Table.Cell>
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
  {/if}

  <ContactDialog bind:open={dialogOpen} contact={editing} />
</main>

<style>
  .contacts {
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
  .head-actions {
    display: flex;
    gap: var(--space-2);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .segments {
    color: var(--text-muted);
    font-size: var(--text-small);
    margin: var(--space-1) 0 0;
  }
  .segments strong {
    color: var(--text-main);
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
</style>
