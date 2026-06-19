<script lang="ts">
  import { replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import { Button } from '$lib/components/ui/button/index.js'
  import { CollapsibleSection } from '$lib/components/ui/collapsible-section/index.js'
  import WishlistItem from '$lib/components/games/WishlistItem.svelte'
  import NewGameWishDialog from '$lib/components/games/NewGameWishDialog.svelte'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import Dice5Icon from '@lucide/svelte/icons/dice-5'
  import type { GameWishRow, MemberRow } from '$lib/server/schema'

  type WishWithMembers = GameWishRow & {
    buyer?: MemberRow | null
    addedBy?: MemberRow | null
  }

  let { data, form } = $props()

  let newOpen = $state(false)

  // Ouverture directe du dialog depuis une action rapide de l'accueil (`?new=1`),
  // puis on nettoie l'URL pour ne pas le rouvrir au rechargement.
  $effect(() => {
    if (page.url.searchParams.get('new') === '1') {
      newOpen = true
      const url = new URL(page.url.href)
      url.searchParams.delete('new')
      replaceState(url, {})
    }
  })

  const wishes = $derived(data.wishes as WishWithMembers[])
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
    <EmptyState
      icon={Dice5Icon}
      title="Aucun souhait pour le moment"
      description="Ajoutez le premier jeu à acheter."
    >
      {#snippet action()}
        <Button onclick={() => (newOpen = true)}>Nouveau souhait</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each wanted as wish (wish.id)}
        <WishlistItem {wish} />
      {/each}
    </div>

    {#if bought.length > 0}
      <CollapsibleSection title="Achetés" count={bought.length}>
        <div class="list">
          {#each bought as wish (wish.id)}
            <WishlistItem {wish} />
          {/each}
        </div>
      </CollapsibleSection>
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
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
