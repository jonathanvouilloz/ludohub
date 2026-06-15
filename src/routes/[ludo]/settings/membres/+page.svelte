<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Table from '$lib/components/ui/table/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import MemberDialog from '$lib/components/membres/MemberDialog.svelte'
  import type { MemberRow } from '$lib/server/schema'

  let { data, form } = $props()

  let dialogOpen = $state(false)
  let editing = $state<MemberRow | null>(null)

  const responsablesActifs = $derived(
    data.members.filter((m) => m.role === 'responsable' && m.isActive).length,
  )

  function openCreate() {
    editing = null
    dialogOpen = true
  }

  function openEdit(member: MemberRow) {
    editing = member
    dialogOpen = true
  }

  function isSelf(member: MemberRow) {
    return member.id === data.currentMember.id
  }

  /** Dernier·e responsable actif·ve : ne peut être ni désactivé·e ni supprimé·e. */
  function isLastResponsable(member: MemberRow) {
    return member.role === 'responsable' && member.isActive && responsablesActifs <= 1
  }
</script>

<svelte:head>
  <title>Membres — {data.ludo.name}</title>
</svelte:head>

<header class="head">
  <div>
    <h1>Membres</h1>
    <p class="muted">Gérez l'équipe de la ludothèque.</p>
  </div>
  <Button onclick={openCreate}>Ajouter un membre</Button>
</header>

{#if form?.error}
  <p class="banner" role="alert">{form.error}</p>
{/if}

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>Nom</Table.Head>
      <Table.Head>Rôle</Table.Head>
      <Table.Head>Statut</Table.Head>
      <Table.Head class="actions-col">Actions</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each data.members as member (member.id)}
      <Table.Row>
        <Table.Cell class="name-cell">
          {member.name}
          {#if isSelf(member)}<span class="you">vous</span>{/if}
        </Table.Cell>
        <Table.Cell>
          {#if member.role === 'responsable'}
            <Badge>Responsable</Badge>
          {:else}
            <Badge variant="secondary">Membre</Badge>
          {/if}
        </Table.Cell>
        <Table.Cell>
          {#if member.isActive}
            <Badge variant="outline">Actif</Badge>
          {:else}
            <Badge variant="destructive">Inactif</Badge>
          {/if}
        </Table.Cell>
        <Table.Cell>
          <div class="actions">
            <Button variant="ghost" size="sm" onclick={() => openEdit(member)}>Modifier</Button>

            {#if member.isActive}
              <form method="POST" action="?/deactivate" use:enhance>
                <input type="hidden" name="id" value={member.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={isSelf(member) || isLastResponsable(member)}
                >
                  Désactiver
                </Button>
              </form>
            {:else}
              <form method="POST" action="?/reactivate" use:enhance>
                <input type="hidden" name="id" value={member.id} />
                <Button type="submit" variant="ghost" size="sm">Réactiver</Button>
              </form>
            {/if}

            <AlertDialog.Root>
              <AlertDialog.Trigger
                class={buttonVariants({ variant: 'ghost', size: 'sm' })}
                disabled={isSelf(member) || isLastResponsable(member)}
              >
                Supprimer
              </AlertDialog.Trigger>
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title>Supprimer {member.name} ?</AlertDialog.Title>
                  <AlertDialog.Description>
                    Action définitive. La suppression est bloquée si ce membre a des assignations ou
                    absences — désactivez-le dans ce cas.
                  </AlertDialog.Description>
                </AlertDialog.Header>
                <form method="POST" action="?/delete" use:enhance>
                  <input type="hidden" name="id" value={member.id} />
                  <AlertDialog.Footer>
                    <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
                    <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
                      Supprimer
                    </button>
                  </AlertDialog.Footer>
                </form>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </div>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<MemberDialog bind:open={dialogOpen} member={editing} />

<style>
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
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
  .actions {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }
  .actions form {
    display: inline;
  }
  .you {
    margin-left: var(--space-2);
    font-size: var(--text-label);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  :global(.actions-col) {
    text-align: right;
  }
</style>
