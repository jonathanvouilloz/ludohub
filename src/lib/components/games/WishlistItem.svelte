<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
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

<article class="item" class:bought>
  <div class="body">
    <div class="title-row">
      <h3>{wish.title}</h3>
      {#if wish.priceChf != null}
        <Badge variant="secondary">{formatPrice(wish.priceChf)}</Badge>
      {/if}
      {#if bought}<Badge class="bought-badge">Acheté</Badge>{/if}
      {#if wish.link}
        <a href={wish.link} target="_blank" rel="noopener" class="link" title="Voir le jeu">
          <ExternalLinkIcon size={16} aria-hidden="true" />
          <span class="sr-only">Voir le jeu (nouvel onglet)</span>
        </a>
      {/if}
    </div>

    <p class="byline">
      Ajouté par {wish.addedBy?.name ?? '—'}
      {#if bought && wish.buyer}
        <span class="sep">·</span> Acheté par {wish.buyer.name} le {formatDateShort(wish.createdAt)}
      {/if}
    </p>
  </div>

  <div class="actions">
    {#if bought}
      <form method="POST" action="?/markWanted" use:enhance>
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
          <form method="POST" action="?/markBought" use:enhance>
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
        <form method="POST" action="?/delete" use:enhance>
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
  </div>
</article>

<style>
  .item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .item.bought {
    opacity: 0.7;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  h3 {
    margin: 0;
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-bold);
    line-height: 1.2;
  }
  .item :global(.bought-badge) {
    background: var(--success);
  }
  .link {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
    text-decoration: none;
    transition: color var(--dur-fast) var(--ease-out-strong);
  }
  .link:hover {
    color: var(--primary);
  }
  .byline {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .sep {
    margin: 0 var(--space-1);
    color: var(--text-subtle);
  }
  .actions {
    display: flex;
    gap: var(--space-1);
    flex-shrink: 0;
    justify-content: flex-end;
  }
  .actions form {
    display: inline-flex;
  }
  .actions :global(.danger-icon) {
    color: var(--danger);
  }
</style>
