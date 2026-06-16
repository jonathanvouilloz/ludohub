<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { GameWishRow, MemberRow } from '$lib/server/schema'

  type WishWithBuyer = GameWishRow & { buyer?: MemberRow | null }

  let { wish }: { wish: WishWithBuyer } = $props()

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
      {#if bought}<Badge>Acheté</Badge>{/if}
    </div>

    <div class="meta">
      {#if wish.priceChf != null}<span class="price">{formatPrice(wish.priceChf)}</span>{/if}
      {#if wish.link}
        <a href={wish.link} target="_blank" rel="noopener" class="link">
          Voir <ExternalLinkIcon size={14} aria-hidden="true" />
        </a>
      {/if}
    </div>

    {#if bought && wish.buyer}
      <p class="muted">Acheté par {wish.buyer.name} le {formatDateShort(wish.createdAt)}</p>
    {/if}
  </div>

  <div class="actions">
    {#if bought}
      <form method="POST" action="?/markWanted" use:enhance>
        <input type="hidden" name="id" value={wish.id} />
        <Button type="submit" variant="ghost" size="sm">Annuler l'achat</Button>
      </form>
    {:else}
      <form method="POST" action="?/markBought" use:enhance>
        <input type="hidden" name="id" value={wish.id} />
        <Button type="submit" variant="ghost" size="sm">Marquer acheté</Button>
      </form>
    {/if}

    <AlertDialog.Root>
      <AlertDialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        Supprimer
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
    gap: var(--space-4);
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
    font-size: var(--text-body);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .price {
    font-weight: var(--weight-medium);
    color: var(--text-main);
  }
  .link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--primary, var(--text-main));
    text-decoration: none;
    font-size: var(--text-small);
  }
  .link:hover {
    text-decoration: underline;
  }
  .muted {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .actions {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .actions form {
    display: inline;
  }
</style>
