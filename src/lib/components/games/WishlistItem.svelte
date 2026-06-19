<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { buttonVariants } from '$lib/components/ui/button/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import CheckIcon from '@lucide/svelte/icons/check'
  import Undo2Icon from '@lucide/svelte/icons/undo-2'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { GameWishRow, MemberRow } from '$lib/server/schema'

  type WishWithMembers = GameWishRow & {
    buyer?: MemberRow | null
    addedBy?: MemberRow | null
  }

  let { wish }: { wish: WishWithMembers } = $props()

  const bought = $derived(wish.status === 'achete')

  /** Centimes → « CHF 12.50 ». */
  function formatPrice(centimes: number): string {
    return `CHF ${(centimes / 100).toFixed(2)}`
  }
</script>

<DataCard title={wish.title} href={wish.link} linkTitle="Voir le jeu" muted={bought}>
  {#snippet badge()}
    {#if wish.priceChf != null}
      <Badge variant="secondary">{formatPrice(wish.priceChf)}</Badge>
    {/if}
  {/snippet}

  {#snippet byline()}
    Ajouté par {wish.addedBy?.name ?? '—'}
    {#if bought && wish.buyer}
      <span class="sep">·</span> Acheté par {wish.buyer.name} le {formatDateShort(wish.createdAt)}
    {/if}
  {/snippet}

  {#snippet actions()}
    {#if bought}
      <form method="POST" action="?/markWanted" use:enhance={toastEnhance({ success: null })}>
        <input type="hidden" name="id" value={wish.id} />
        <Button type="submit" variant="ghost" size="icon-sm" title="Annuler l'achat">
          <Undo2Icon aria-hidden="true" />
          <span class="sr-only">Annuler l'achat</span>
        </Button>
      </form>
    {:else}
      <AlertDialog.Root>
        <AlertDialog.Trigger
          class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          title="Marquer comme acheté"
        >
          <CheckIcon aria-hidden="true" />
          <span class="sr-only">Marquer comme acheté</span>
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Marquer « {wish.title} » comme acheté ?</AlertDialog.Title>
            <AlertDialog.Description>
              Le jeu sera déplacé dans la liste des achats. Réversible à tout moment.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <form method="POST" action="?/markBought" use:enhance={toastEnhance({ success: null })}>
            <input type="hidden" name="id" value={wish.id} />
            <AlertDialog.Footer>
              <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
              <button type="submit" class={buttonVariants()}>Confirmer l'achat</button>
            </AlertDialog.Footer>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {/if}

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
          <AlertDialog.Title>Supprimer « {wish.title} » ?</AlertDialog.Title>
          <AlertDialog.Description>Action définitive.</AlertDialog.Description>
        </AlertDialog.Header>
        <form
          method="POST"
          action="?/delete"
          use:enhance={toastEnhance({ success: 'Jeu supprimé.' })}
        >
          <input type="hidden" name="id" value={wish.id} />
          <AlertDialog.Footer>
            <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
            <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
              Supprimer
            </button>
          </AlertDialog.Footer>
        </form>
      </AlertDialog.Content>
    </AlertDialog.Root>
  {/snippet}
</DataCard>

<style>
  .sep {
    margin: 0 var(--space-1);
    color: var(--text-subtle);
  }
</style>
