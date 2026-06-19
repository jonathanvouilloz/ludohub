<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Table from '$lib/components/ui/table/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import ArchiveIcon from '@lucide/svelte/icons/archive'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import ZapIcon from '@lucide/svelte/icons/zap'
  import SeasonDialog from '$lib/components/planning/SeasonDialog.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'

  let { data } = $props()

  type Season = (typeof data.seasons)[number]

  let dialogOpen = $state(false)
</script>

<svelte:head>
  <title>Saisons — {data.ludo.name}</title>
</svelte:head>

<main class="seasons">
  <header class="head">
    <div>
      <h1>Saisons</h1>
      <p class="muted">
        {data.responsable
          ? 'Créez une saison pour générer ses samedis.'
          : 'Consultez les saisons de la ludothèque.'}
      </p>
    </div>
    {#if data.responsable}
      <Button onclick={() => (dialogOpen = true)}>Nouvelle saison</Button>
    {/if}
  </header>

  {#snippet rowActions(season: Season)}
    <Button
      variant="ghost"
      size="icon-sm"
      title="Ouvrir"
      href="/{data.ludo.slug}/planning/saisons/{season.id}"
    >
      <ArrowRightIcon aria-hidden="true" />
      <span class="sr-only">Ouvrir</span>
    </Button>

    {#if data.responsable}
      {#if !season.isActive && !season.isArchived}
        <form method="POST" action="?/activate" use:enhance={toastEnhance({ success: null })}>
          <input type="hidden" name="id" value={season.id} />
          <Button type="submit" variant="ghost" size="icon-sm" title="Activer cette saison">
            <ZapIcon aria-hidden="true" />
            <span class="sr-only">Activer</span>
          </Button>
        </form>
      {/if}

      <form
        method="POST"
        action="?/archive"
        use:enhance={toastEnhance({ success: 'Saison archivée.' })}
      >
        <input type="hidden" name="id" value={season.id} />
        <input type="hidden" name="archived" value={(!season.isArchived).toString()} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          title={season.isArchived ? 'Désarchiver' : 'Archiver'}
        >
          <ArchiveIcon aria-hidden="true" />
          <span class="sr-only">{season.isArchived ? 'Désarchiver' : 'Archiver'}</span>
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
            <AlertDialog.Title>Supprimer {season.name} ?</AlertDialog.Title>
            <AlertDialog.Description>
              Action définitive : tous les samedis et assignations de cette saison seront supprimés.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <form
            method="POST"
            action="?/delete"
            use:enhance={toastEnhance({ success: 'Saison supprimée.' })}
          >
            <input type="hidden" name="id" value={season.id} />
            <AlertDialog.Footer>
              <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
              <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
                Supprimer
              </button>
            </AlertDialog.Footer>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {/if}
  {/snippet}

  {#if data.seasons.length === 0}
    <p class="muted">Aucune saison pour l'instant.</p>
  {:else}
    <DataTable>
      {#snippet head()}
        <Table.Row>
          <Table.Head>Nom</Table.Head>
          <Table.Head>Période</Table.Head>
          <Table.Head>Statut</Table.Head>
          <Table.Head class="actions-col">Actions</Table.Head>
        </Table.Row>
      {/snippet}
      {#snippet body()}
        {#each data.seasons as season (season.id)}
          <Table.Row>
            <Table.Cell>
              <a class="name" href="/{data.ludo.slug}/planning/saisons/{season.id}">{season.name}</a
              >
            </Table.Cell>
            <Table.Cell>
              {formatDateShort(season.startDate)} – {formatDateShort(season.endDate)}
            </Table.Cell>
            <Table.Cell>
              {#if season.isActive}
                <Badge variant="success">Active</Badge>
              {:else if season.isArchived}
                <Badge variant="secondary">Archivée</Badge>
              {:else}
                <Badge variant="outline">En préparation</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <div class="actions">{@render rowActions(season)}</div>
            </Table.Cell>
          </Table.Row>
        {/each}
      {/snippet}
      {#snippet cards()}
        {#each data.seasons as season (season.id)}
          <DataCard title={season.name}>
            {#snippet badge()}
              {#if season.isActive}
                <Badge variant="success">Active</Badge>
              {:else if season.isArchived}
                <Badge variant="secondary">Archivée</Badge>
              {:else}
                <Badge variant="outline">En préparation</Badge>
              {/if}
            {/snippet}
            {#snippet byline()}
              {formatDateShort(season.startDate)} – {formatDateShort(season.endDate)}
            {/snippet}
            {#snippet actions()}{@render rowActions(season)}{/snippet}
          </DataCard>
        {/each}
      {/snippet}
    </DataTable>
  {/if}
</main>

<SeasonDialog bind:open={dialogOpen} />

<style>
  .seasons {
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
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .name {
    color: var(--ludo-color);
    font-weight: var(--weight-medium);
    text-decoration: none;
  }
  .name:hover {
    text-decoration: underline;
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
</style>
