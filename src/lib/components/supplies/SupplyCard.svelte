<script lang="ts">
  import { enhance } from '$app/forms'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import ShoppingCartIcon from '@lucide/svelte/icons/shopping-cart'
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
  const urgencyVariant = {
    critique: 'destructive',
    haute: 'secondary',
    normale: 'outline',
  } as const
  const statusLabels: Record<string, string> = {
    en_attente: 'En attente',
    commande: 'Commandé',
    recu: 'Reçu',
  }
  const statusVariant = { recu: 'default', commande: 'secondary', en_attente: 'outline' } as const

  // Cycle de vie linéaire : en_attente → commande → recu.
  const forwardStatus: Record<string, { status: string; label: string } | null> = {
    en_attente: { status: 'commande', label: 'Marquer commandé' },
    commande: { status: 'recu', label: 'Marquer reçu' },
    recu: null,
  }
  const backStatus: Record<string, string | null> = {
    en_attente: null,
    commande: 'en_attente',
    recu: 'commande',
  }

  const next = $derived(forwardStatus[supply.status])
  const prev = $derived(backStatus[supply.status])
  const canDelete = $derived(responsable || supply.memberId === currentMemberId)
</script>

<article class="card">
  <header class="card-head">
    <Badge variant={urgencyVariant[supply.urgency]}>{urgencyLabels[supply.urgency]}</Badge>
    <span class="category">{categoryLabels[supply.category] ?? supply.category}</span>
  </header>

  <h3>{supply.name}</h3>
  {#if supply.notes}<p class="notes">{supply.notes}</p>{/if}

  <footer class="card-foot">
    <span class="byline">Demandé par {supply.member?.name ?? '—'}</span>

    <div class="foot-actions">
      <Badge variant={statusVariant[supply.status]}>{statusLabels[supply.status]}</Badge>

      {#if prev}
        <form method="POST" action="?/updateStatus" use:enhance>
          <input type="hidden" name="id" value={supply.id} />
          <input type="hidden" name="status" value={prev} />
          <Button type="submit" variant="ghost" size="icon-sm" title="Revenir en arrière">
            <Undo2Icon aria-hidden="true" />
            <span class="sr-only">Revenir au statut précédent</span>
          </Button>
        </form>
      {/if}
      {#if next}
        <form method="POST" action="?/updateStatus" use:enhance>
          <input type="hidden" name="id" value={supply.id} />
          <input type="hidden" name="status" value={next.status} />
          <Button type="submit" variant="outline" size="sm">
            {#if next.status === 'commande'}
              <ShoppingCartIcon aria-hidden="true" />
            {:else}
              <CheckIcon aria-hidden="true" />
            {/if}
            {next.label}
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
  </footer>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .category {
    color: var(--text-muted);
  }

  h3 {
    margin: 0;
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-bold);
    line-height: 1.2;
  }
  .notes {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-1);
  }
  .byline {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .foot-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .foot-actions form {
    display: inline-flex;
  }
  .foot-actions :global(.danger-icon) {
    color: var(--danger);
  }
</style>
