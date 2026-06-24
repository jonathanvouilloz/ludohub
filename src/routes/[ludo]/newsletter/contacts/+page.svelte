<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import ContactDialog from '$lib/components/newsletter/ContactDialog.svelte'
  import ContactsTable from '$lib/components/newsletter/ContactsTable.svelte'
  import UsersRoundIcon from '@lucide/svelte/icons/users-round'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import UserMinusIcon from '@lucide/svelte/icons/user-minus'
  import UserCheckIcon from '@lucide/svelte/icons/user-check'
  import UserXIcon from '@lucide/svelte/icons/user-x'
  import { TAG_LABELS } from '$lib/newsletter/tags'
  import type { NewsletterContactRow } from '$lib/server/schema'

  let { data } = $props()

  const slug = $derived(data.ludo.slug)
  const contacts = $derived(data.contacts as NewsletterContactRow[])
  const subscribedCount = $derived(data.subscribedByTag.total)

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
</script>

<svelte:head>
  <title>Contacts — Newsletter — {data.ludo.name}</title>
</svelte:head>

<main class="contacts">
  <header class="head">
    <div>
      <h1>Contacts</h1>
      <p class="muted">
        Le public de votre ludothèque — {data.total}
        {data.total > 1 ? 'contacts' : 'contact'}, {subscribedCount} abonné{subscribedCount > 1
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

    {#if c.status !== 'bounced'}
      <form
        method="POST"
        action="?/toggleSubscription"
        use:enhance={toastEnhance({
          success: c.status === 'subscribed' ? 'Contact désabonné.' : 'Contact réabonné.',
        })}
      >
        <input type="hidden" name="id" value={c.id} />
        <input
          type="hidden"
          name="subscribed"
          value={c.status === 'subscribed' ? 'false' : 'true'}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          title={c.status === 'subscribed' ? 'Désabonner' : 'Réabonner'}
        >
          {#if c.status === 'subscribed'}
            <UserMinusIcon aria-hidden="true" />
          {:else}
            <UserCheckIcon aria-hidden="true" />
          {/if}
          <span class="sr-only">{c.status === 'subscribed' ? 'Désabonner' : 'Réabonner'}</span>
        </Button>
      </form>
    {/if}

    <AlertDialog.Root>
      <AlertDialog.Trigger
        class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        title="Anonymiser (RGPD)"
      >
        <UserXIcon aria-hidden="true" />
        <span class="sr-only">Anonymiser</span>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Anonymiser ce contact ?</AlertDialog.Title>
          <AlertDialog.Description>
            Les données personnelles de {c.email} (email, nom, notes) seront effacées et le contact désabonné.
            La ligne est conservée pour préserver les statistiques d'envoi. Action définitive — pour un
            retrait total, utilisez « Supprimer ».
          </AlertDialog.Description>
        </AlertDialog.Header>
        <form
          method="POST"
          action="?/anonymize"
          use:enhance={toastEnhance({ success: 'Contact anonymisé.' })}
        >
          <input type="hidden" name="id" value={c.id} />
          <AlertDialog.Footer>
            <AlertDialog.Cancel type="button">Retour</AlertDialog.Cancel>
            <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
              Anonymiser
            </button>
          </AlertDialog.Footer>
        </form>
      </AlertDialog.Content>
    </AlertDialog.Root>

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
            {c.email} sera définitivement retiré de votre liste, ainsi que son historique d'envois.
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
    <ContactsTable
      {contacts}
      sort={data.sort}
      page={data.page}
      pageCount={data.pageCount}
      {rowActions}
    />
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
</style>
