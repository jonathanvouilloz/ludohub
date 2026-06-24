<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Table from '$lib/components/ui/table/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import ArchiveIcon from '@lucide/svelte/icons/archive'
  import ArchiveRestoreIcon from '@lucide/svelte/icons/archive-restore'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import type { EventTypeRow } from '$lib/server/schema'

  let { data } = $props()

  let createName = $state('')
  let creating = $state(false)

  let renameOpen = $state(false)
  let renaming = $state<EventTypeRow | null>(null)
  let renameName = $state('')

  function openRename(type: EventTypeRow) {
    renaming = type
    renameName = type.name
    renameOpen = true
  }
</script>

<svelte:head>
  <title>Types d'événement — {data.ludo.name}</title>
</svelte:head>

<header class="head">
  <div>
    <h1>Types d'événement</h1>
    <p class="muted">Définissez les libellés proposés à la clôture d'une séance « Événement ».</p>
  </div>
</header>

<form
  class="create"
  method="POST"
  action="?/create"
  use:enhance={toastEnhance({
    success: 'Type ajouté.',
    onPending: (p) => (creating = p),
    onSuccess: () => (createName = ''),
  })}
>
  <div class="field">
    <Label for="new-type">Nouveau type</Label>
    <Input
      id="new-type"
      name="name"
      bind:value={createName}
      placeholder="ex. Soirée jeux, Anniversaire…"
      required
    />
  </div>
  <Button type="submit" disabled={creating || !createName.trim()}>Ajouter</Button>
</form>

{#snippet rowActions(type: EventTypeRow)}
  <Button variant="ghost" size="icon-sm" title="Renommer" onclick={() => openRename(type)}>
    <PencilIcon aria-hidden="true" />
    <span class="sr-only">Renommer</span>
  </Button>

  <form
    method="POST"
    action="?/archive"
    use:enhance={toastEnhance({ success: type.isArchived ? 'Type réactivé.' : 'Type archivé.' })}
  >
    <input type="hidden" name="id" value={type.id} />
    <input type="hidden" name="archived" value={type.isArchived ? 'false' : 'true'} />
    <Button
      type="submit"
      variant="ghost"
      size="icon-sm"
      title={type.isArchived ? 'Réactiver' : 'Archiver'}
    >
      {#if type.isArchived}
        <ArchiveRestoreIcon aria-hidden="true" />
      {:else}
        <ArchiveIcon aria-hidden="true" />
      {/if}
      <span class="sr-only">{type.isArchived ? 'Réactiver' : 'Archiver'}</span>
    </Button>
  </form>

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
        <AlertDialog.Title>Supprimer « {type.name} » ?</AlertDialog.Title>
        <AlertDialog.Description>
          Les séances passées gardent leur libellé. Ce type ne sera plus proposé à la clôture.
          Action définitive — préférez l'archivage si vous hésitez.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <form
        method="POST"
        action="?/delete"
        use:enhance={toastEnhance({ success: 'Type supprimé.' })}
      >
        <input type="hidden" name="id" value={type.id} />
        <AlertDialog.Footer>
          <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
          <button type="submit" class={buttonVariants({ variant: 'destructive' })}>Supprimer</button
          >
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/snippet}

{#if data.eventTypes.length === 0}
  <p class="muted empty">Aucun type pour le moment. Ajoutez-en un ci-dessus.</p>
{:else}
  <DataTable>
    {#snippet head()}
      <Table.Row>
        <Table.Head>Nom</Table.Head>
        <Table.Head>Statut</Table.Head>
        <Table.Head class="actions-col">Actions</Table.Head>
      </Table.Row>
    {/snippet}
    {#snippet body()}
      {#each data.eventTypes as type (type.id)}
        <Table.Row>
          <Table.Cell>{type.name}</Table.Cell>
          <Table.Cell>
            {#if type.isArchived}
              <Badge variant="secondary">Archivé</Badge>
            {:else}
              <Badge variant="success">Actif</Badge>
            {/if}
          </Table.Cell>
          <Table.Cell>
            <div class="actions">{@render rowActions(type)}</div>
          </Table.Cell>
        </Table.Row>
      {/each}
    {/snippet}
    {#snippet cards()}
      {#each data.eventTypes as type (type.id)}
        <DataCard title={type.name}>
          {#snippet badge()}
            {#if type.isArchived}
              <Badge variant="secondary">Archivé</Badge>
            {:else}
              <Badge variant="success">Actif</Badge>
            {/if}
          {/snippet}
          {#snippet actions()}{@render rowActions(type)}{/snippet}
        </DataCard>
      {/each}
    {/snippet}
  </DataTable>
{/if}

<Dialog.Root bind:open={renameOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Renommer le type</Dialog.Title>
      <Dialog.Description>Le nouveau nom s'appliquera aux prochaines séances.</Dialog.Description>
    </Dialog.Header>
    <form
      method="POST"
      action="?/rename"
      use:enhance={toastEnhance({
        success: 'Type renommé.',
        onSuccess: () => (renameOpen = false),
      })}
    >
      <input type="hidden" name="id" value={renaming?.id} />
      <div class="field">
        <Label for="rename-type">Nom</Label>
        <Input id="rename-type" name="name" bind:value={renameName} required />
      </div>
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (renameOpen = false)}>Annuler</Button
        >
        <Button type="submit" disabled={!renameName.trim()}>Enregistrer</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  .head {
    margin-bottom: var(--space-6);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .create {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .create .field {
    flex: 1;
  }
  .empty {
    padding: var(--space-4) 0;
  }
  .actions {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }
  .actions form {
    display: inline;
  }
  :global(.actions-col) {
    text-align: right;
  }
  form :global(.danger-icon) {
    color: var(--danger);
  }
</style>
