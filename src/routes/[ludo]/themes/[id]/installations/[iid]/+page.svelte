<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js'
  import CheckupForm from '$lib/components/themes/CheckupForm.svelte'
  import CheckupHistory from '$lib/components/themes/CheckupHistory.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'

  let { data, form } = $props()

  const inst = $derived(data.installation)
  const isOpen = $derived(inst.status === 'en_cours')
  const formItems = $derived(
    inst.items.map((it) => ({
      id: it.id,
      name: it.themeItem.name,
      quantity: it.themeItem.quantity,
    })),
  )
</script>

<svelte:head>
  <title>Installation — {inst.theme.name}</title>
</svelte:head>

<main class="install">
  <header class="head">
    <a class="back" href="/{data.ludo.slug}/themes/{inst.themeId}">← {inst.theme.name}</a>
    <h1>
      Installation
      {#if isOpen}
        <Badge variant="secondary">En cours</Badge>
      {:else}
        <Badge variant="outline">Clôturée</Badge>
      {/if}
    </h1>
    <p class="muted">
      Installée le {formatDateShort(inst.installedAt)} par {inst.installedBy?.name ?? '—'} ·
      {inst.items.length} item(s) sortis
      {#if !isOpen && inst.closedAt}· clôturée le {formatDateShort(inst.closedAt)}{/if}
    </p>
    {#if inst.notes}<p class="note">{inst.notes}</p>{/if}
  </header>

  {#if form?.success}
    <p class="banner-ok" role="status">Check-up enregistré.</p>
  {/if}

  <div class="columns">
    <section class="col">
      <h2>{isOpen ? 'Nouveau check-up' : 'Items installés'}</h2>
      {#if isOpen}
        <CheckupForm items={formItems} />
      {:else}
        <ul class="items">
          {#each inst.items as it (it.id)}
            <li>{it.themeItem.name} <span class="qty">×{it.themeItem.quantity}</span></li>
          {/each}
        </ul>
        <p class="muted">Installation clôturée : plus de check-up possible.</p>
      {/if}
    </section>

    <section class="col">
      <h2>Historique des check-ups</h2>
      <CheckupHistory checkups={inst.checkups} />
    </section>
  </div>
</main>

<style>
  .install {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    margin-bottom: var(--space-6);
  }
  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
  }
  h1 {
    color: var(--text-main);
    margin: var(--space-2) 0 var(--space-1);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-semibold);
    margin: 0 0 var(--space-3);
  }
  .banner-ok {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--success-light);
    color: var(--success);
    font-size: var(--text-small);
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-8);
  }
  @media (max-width: 720px) {
    .columns {
      grid-template-columns: 1fr;
      gap: var(--space-4);
    }
  }
  .col {
    min-width: 0;
  }
  .items {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
  }
  .items li {
    padding: var(--space-1) 0;
    color: var(--text-main);
    border-bottom: 1px solid var(--border);
  }
  .qty {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .muted {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .note {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
</style>
