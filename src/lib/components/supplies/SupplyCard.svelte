<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import CheckIcon from '@lucide/svelte/icons/check'
  import Undo2Icon from '@lucide/svelte/icons/undo-2'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import type { SupplyRequestRow, MemberRow } from '$lib/server/schema'

  type SupplyWithMember = SupplyRequestRow & { member?: MemberRow | null }

  let {
    supply,
    responsable,
    currentMemberId,
  }: { supply: SupplyWithMember; responsable: boolean; currentMemberId: string } = $props()

  const urgencyLabels: Record<string, string> = {
    normale: 'Normale',
    haute: 'Haute',
    critique: 'Critique',
  }
  const urgencyColors: Record<string, string> = {
    normale: 'var(--text-subtle)',
    haute: 'var(--warning)',
    critique: 'var(--danger)',
  }

  const bought = $derived(supply.status === 'recu')
  const canDelete = $derived(responsable || supply.memberId === currentMemberId)
</script>

{#snippet notesContent()}{supply.notes}{/snippet}

<DataCard
  title={supply.name}
  href={supply.link}
  linkTitle="Voir le lien"
  muted={bought}
  dotColor={urgencyColors[supply.urgency] ?? 'var(--text-subtle)'}
  dotTitle="Urgence : {urgencyLabels[supply.urgency]}"
  notes={supply.notes ? notesContent : undefined}
>
  {#snippet byline()}
    Demandé par {supply.member?.name ?? '—'}
  {/snippet}

  {#snippet actions()}
    {#if bought}
      <form method="POST" action="?/updateStatus" use:enhance={toastEnhance({ success: null })}>
        <input type="hidden" name="id" value={supply.id} />
        <input type="hidden" name="status" value="en_attente" />
        <Button type="submit" variant="ghost" size="icon-sm" title="Annuler l'achat">
          <Undo2Icon aria-hidden="true" />
          <span class="sr-only">Annuler l'achat</span>
        </Button>
      </form>
    {:else}
      <form method="POST" action="?/updateStatus" use:enhance={toastEnhance({ success: null })}>
        <input type="hidden" name="id" value={supply.id} />
        <input type="hidden" name="status" value="recu" />
        <Button type="submit" variant="ghost" size="icon-sm" title="Marquer acheté">
          <CheckIcon aria-hidden="true" />
          <span class="sr-only">Marquer acheté</span>
        </Button>
      </form>
    {/if}

    {#if canDelete}
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
            <AlertDialog.Title>Supprimer « {supply.name} » ?</AlertDialog.Title>
            <AlertDialog.Description>Action définitive.</AlertDialog.Description>
          </AlertDialog.Header>
          <form
            method="POST"
            action="?/delete"
            use:enhance={toastEnhance({ success: 'Demande supprimée.' })}
          >
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
  {/snippet}
</DataCard>
