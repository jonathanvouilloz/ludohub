<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Table from '$lib/components/ui/table/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { buttonVariants } from '$lib/components/ui/button/index.js'
  import type { SupplyRequestRow, MemberRow } from '$lib/server/schema'

  type SupplyWithMember = SupplyRequestRow & { member?: MemberRow | null }

  let {
    supply,
    responsable,
    currentMemberId,
  }: { supply: SupplyWithMember; responsable: boolean; currentMemberId: string } = $props()

  const categoryLabels: Record<string, string> = {
    jeux: 'Jeux',
    materiel: 'Matériel',
    fournitures: 'Fournitures',
    autre: 'Autre',
  }
  const urgencyLabels: Record<string, string> = {
    normale: 'Normale',
    haute: 'Haute',
    critique: 'Critique',
  }
  const statusLabels: Record<string, string> = {
    en_attente: 'En attente',
    commande: 'Commandé',
    recu: 'Reçu',
  }
  const urgencyVariant = {
    critique: 'destructive',
    haute: 'secondary',
    normale: 'outline',
  } as const
  const statusVariant = { recu: 'default', commande: 'secondary', en_attente: 'outline' } as const

  let statusForm = $state<HTMLFormElement | null>(null)
  // Valeur liée au Select ; resynchronisée sur la donnée serveur (après update).
  let status = $state<string>('en_attente')

  $effect(() => {
    status = supply.status
  })

  const canDelete = $derived(responsable || supply.memberId === currentMemberId)
</script>

<Table.Row>
  <Table.Cell class="name-cell">
    {supply.name}
    {#if supply.notes}<span class="notes">{supply.notes}</span>{/if}
  </Table.Cell>
  <Table.Cell>{categoryLabels[supply.category] ?? supply.category}</Table.Cell>
  <Table.Cell>
    <Badge variant={urgencyVariant[supply.urgency]}>{urgencyLabels[supply.urgency]}</Badge>
  </Table.Cell>
  <Table.Cell>
    {#if responsable}
      <form method="POST" action="?/updateStatus" use:enhance bind:this={statusForm}>
        <input type="hidden" name="id" value={supply.id} />
        <Select.Root
          type="single"
          name="status"
          bind:value={status}
          onValueChange={(v) => {
            if (v && v !== supply.status) statusForm?.requestSubmit()
          }}
        >
          <Select.Trigger class="status-trigger">{statusLabels[status]}</Select.Trigger>
          <Select.Content>
            <Select.Item value="en_attente" label="En attente" />
            <Select.Item value="commande" label="Commandé" />
            <Select.Item value="recu" label="Reçu" />
          </Select.Content>
        </Select.Root>
      </form>
    {:else}
      <Badge variant={statusVariant[supply.status]}>{statusLabels[supply.status]}</Badge>
    {/if}
  </Table.Cell>
  <Table.Cell>{supply.member?.name ?? '—'}</Table.Cell>
  <Table.Cell>
    <div class="actions">
      {#if canDelete}
        <AlertDialog.Root>
          <AlertDialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Supprimer
          </AlertDialog.Trigger>
          <AlertDialog.Content>
            <AlertDialog.Header>
              <AlertDialog.Title>Supprimer « {supply.name} » ?</AlertDialog.Title>
              <AlertDialog.Description>Action définitive.</AlertDialog.Description>
            </AlertDialog.Header>
            <form method="POST" action="?/delete" use:enhance>
              <input type="hidden" name="id" value={supply.id} />
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
    </div>
  </Table.Cell>
</Table.Row>

<style>
  :global(.name-cell) {
    font-weight: var(--weight-medium);
  }
  .notes {
    display: block;
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-regular, 400);
  }
  :global(.status-trigger) {
    min-width: 9rem;
  }
  .actions {
    display: flex;
    gap: var(--space-1);
    justify-content: flex-end;
  }
  .actions form {
    display: inline;
  }
</style>
