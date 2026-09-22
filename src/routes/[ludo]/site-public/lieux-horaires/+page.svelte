<script lang="ts">
  import PlusIcon from '@lucide/svelte/icons/plus'
  import { Button } from '$lib/components/ui/button/index.js'
  import HoursPreview from '$lib/components/settings/HoursPreview.svelte'
  import SiteCreateForm from '$lib/components/settings/SiteCreateForm.svelte'

  let { data, form } = $props()
  let creating = $state(false)

  const activeSites = $derived(data.sites.filter((site) => site.isActive))
  const previewSites = $derived(
    activeSites.map((site) => ({ ...site, openingHours: site.openingIntervals })),
  )
</script>

<svelte:head>
  <title>Lieux et horaires · Site public</title>
</svelte:head>

<main class="page-shell">
<header class="head">
  <div>
    <h1>Lieux et horaires</h1>
    <p>Coordonnées et heures d’ouverture communiquées au public.</p>
  </div>
  {#if data.canEdit}
    <Button variant="outline" onclick={() => (creating = !creating)}>
      <PlusIcon size={16} /> {creating ? 'Annuler' : 'Ajouter un lieu'}
    </Button>
  {/if}
</header>

{#if form?.error}
  <p class="banner" role="alert">{form.error}</p>
{/if}

{#if creating}
  <SiteCreateForm oncreated={() => (creating = false)} />
{:else if data.sites.length === 0}
  <section class="empty">
    <h2>Aucun lieu configuré</h2>
    {#if data.canEdit}
      <p>Ajoutez votre premier lieu pour pouvoir activer le site public.</p>
      <SiteCreateForm />
    {:else}
      <p>Un responsable doit ajouter le premier lieu.</p>
    {/if}
  </section>
{:else}
  <section aria-labelledby="preview-title">
    <div class="section-head">
      <div>
        <p class="section-label">Aperçu public interne</p>
        <h2 id="preview-title">Ce que verront vos visiteurs</h2>
      </div>
    </div>
    <HoursPreview sites={previewSites} editable={data.canEdit} />
  </section>
{/if}
</main>

<style>
  .page-shell {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-4) var(--space-6) var(--space-12);
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  h1,
  h2 {
    margin: 0;
    color: var(--text-main);
  }
  .head p,
  .empty p {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
  .section-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .section-label {
    margin: 0 0 var(--space-1);
    color: var(--ludo-color);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .empty {
    padding: var(--space-8);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    text-align: center;
  }
  @media (max-width: 640px) {
    .page-shell {
      padding: var(--space-3) var(--space-4) var(--space-10);
    }
    .head {
      flex-direction: column;
    }
    .section-head {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
