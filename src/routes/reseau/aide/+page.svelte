<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import HelpRequestFeed from '$lib/components/help/HelpRequestFeed.svelte'
  import NewHelpRequestDialog from '$lib/components/help/NewHelpRequestDialog.svelte'

  let { data, form } = $props()

  const feed = $derived(data.feed)
  const past = $derived(data.past)

  let dialogOpen = $state(false)
</script>

<svelte:head>
  <title>Demandes d'aide — Réseau</title>
</svelte:head>

<main class="reseau">
  <header>
    <div class="title-row">
      <div>
        <h1>Demandes d'aide</h1>
        <p class="muted">Les demandes de remplacement de toutes les ludothèques du réseau.</p>
      </div>
      <Button onclick={() => (dialogOpen = true)}>Nouvelle demande</Button>
    </div>
  </header>

  {#if form?.error}
    <p class="banner" role="alert">{form.error}</p>
  {/if}

  <HelpRequestFeed requests={feed} />

  {#if past.length > 0}
    <section class="past">
      <h2>Mes demandes passées</h2>
      <HelpRequestFeed requests={past} readonly />
    </section>
  {/if}

  <NewHelpRequestDialog bind:open={dialogOpen} />
</main>

<style>
  .reseau {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .title-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
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
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
  .past h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-semibold);
    margin: 0 0 var(--space-4);
  }
</style>
