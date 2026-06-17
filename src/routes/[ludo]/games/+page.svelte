<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import WishlistItem from '$lib/components/games/WishlistItem.svelte'
  import NewGameWishDialog from '$lib/components/games/NewGameWishDialog.svelte'
  import type { GameWishRow, MemberRow } from '$lib/server/schema'

  type WishWithBuyer = GameWishRow & { buyer?: MemberRow | null }

  let { data, form } = $props()

  let newOpen = $state(false)

  const wishes = $derived(data.wishes as WishWithBuyer[])
  const wanted = $derived(wishes.filter((w) => w.status === 'souhaite'))
  const bought = $derived(wishes.filter((w) => w.status === 'achete'))
</script>

<svelte:head>
  <title>Jeux à acheter — {data.ludo.name}</title>
</svelte:head>

<main class="games">
  <header class="head">
    <div>
      <h1>Jeux à acheter</h1>
      <p class="muted">La liste des jeux que la ludothèque souhaite acquérir.</p>
    </div>
    <Button onclick={() => (newOpen = true)}>Nouveau souhait</Button>
  </header>

  {#if form?.error}
    <p class="banner" role="alert">{form.error}</p>
  {/if}

  {#if wishes.length === 0}
    <p class="empty">Aucun souhait pour le moment. Ajoutez le premier jeu à acheter.</p>
  {:else}
    <div class="list">
      {#each wanted as wish (wish.id)}
        <WishlistItem {wish} />
      {/each}
    </div>

    {#if bought.length > 0}
      <section class="bought-section">
        <h2>Achetés ({bought.length})</h2>
        <div class="list">
          {#each bought as wish (wish.id)}
            <WishlistItem {wish} />
          {/each}
        </div>
      </section>
    {/if}
  {/if}

  <NewGameWishDialog bind:open={newOpen} />
</main>

<style>
  .games {
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
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-semibold);
    margin: 0 0 var(--space-3);
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
  .empty {
    color: var(--text-subtle);
    font-style: italic;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .bought-section {
    margin-top: var(--space-8);
  }
</style>
