<script lang="ts">
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down'
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import HoursPreview from '$lib/components/settings/HoursPreview.svelte'
  import SiteEditor from '$lib/components/settings/SiteEditor.svelte'
  import SiteCreateForm from '$lib/components/settings/SiteCreateForm.svelte'
  import { toastEnhance } from '$lib/utils/enhance'

  let { data, form } = $props()
  let mode = $state<'preview' | 'edit'>('preview')
  let dirtySites = $state<Record<string, boolean>>({})
  let creating = $state(false)

  const activeSites = $derived(data.sites.filter((site) => site.isActive))
  const multiSite = $derived(data.sites.length > 1)
  const hasDirty = $derived(Object.values(dirtySites).some(Boolean))
  const previewSites = $derived(
    activeSites.map((site) => ({ ...site, openingHours: site.openingIntervals })),
  )

  $effect.pre(() => {
    for (const site of data.sites) {
      if (!(site.id in dirtySites)) dirtySites[site.id] = false
    }
  })

  function movedIds(index: number, direction: -1 | 1): string[] {
    const ids = data.sites.map((site) => site.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return ids
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    return ids
  }
</script>

<svelte:head>
  <title>Lieux et horaires</title>
</svelte:head>

<header class="head">
  <div>
    <h1>Lieux et horaires</h1>
    <p>Coordonnées et heures d’ouverture communiquées au public.</p>
  </div>
  {#if data.canEdit}
    <Button
      variant="outline"
      disabled={mode === 'edit' && hasDirty}
      title={mode === 'edit' && hasDirty
        ? 'Enregistrez vos modifications avant de quitter.'
        : undefined}
      onclick={() => (mode = mode === 'preview' ? 'edit' : 'preview')}
    >
      {#if mode === 'preview'}<PencilIcon size={16} /> Modifier{:else}<EyeIcon size={16} /> Voir l’aperçu{/if}
    </Button>
  {/if}
</header>

{#if form?.error}
  <p class="banner" role="alert">{form.error}</p>
{/if}

{#if data.sites.length === 0}
  <section class="empty">
    <h2>Aucun lieu configuré</h2>
    {#if data.canEdit}
      <p>Ajoutez votre premier lieu pour pouvoir activer le site public.</p>
      <SiteCreateForm />
    {:else}
      <p>Un responsable doit ajouter le premier lieu.</p>
    {/if}
  </section>
{:else if mode === 'preview' || !data.canEdit}
  <section aria-labelledby="preview-title">
    <div class="section-head">
      <div>
        <p class="section-label">Aperçu public interne</p>
        <h2 id="preview-title">Ce que verront vos visiteurs</h2>
      </div>
    </div>
    <HoursPreview sites={previewSites} />
  </section>
{:else}
  <section aria-labelledby="edit-title">
    <div class="section-head">
      <div>
        <p class="section-label">Édition</p>
        <h2 id="edit-title">{multiSite ? 'Vos lieux' : 'Votre ludothèque'}</h2>
      </div>
      <div class="section-actions">
        {#if multiSite}<p class="section-help">L’ordre est repris dans l’affichage public.</p>{/if}
        <Button variant="outline" onclick={() => (creating = !creating)}>
          <PlusIcon size={16} />
          {creating ? 'Annuler' : 'Ajouter un lieu'}
        </Button>
      </div>
    </div>

    {#if creating}
      <SiteCreateForm oncreated={() => (creating = false)} />
    {/if}

    {#if multiSite && hasDirty}
      <p class="reorder-warning" role="status">
        Enregistrez vos modifications avant de changer l’ordre des lieux.
      </p>
    {/if}

    <div class="editors">
      {#each data.sites as site, index (site.id)}
        <div class="editor-row">
          {#if multiSite}
            <div class="order-actions" aria-label={`Ordre de ${site.name}`}>
              <form
                method="POST"
                action="?/reorder"
                use:enhance={toastEnhance({ success: 'Ordre mis à jour.' })}
              >
                <input
                  type="hidden"
                  name="orderedIds"
                  value={JSON.stringify(movedIds(index, -1))}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  disabled={hasDirty || index === 0}
                  aria-label="Monter"
                >
                  <ArrowUpIcon size={16} />
                </Button>
              </form>
              <form
                method="POST"
                action="?/reorder"
                use:enhance={toastEnhance({ success: 'Ordre mis à jour.' })}
              >
                <input type="hidden" name="orderedIds" value={JSON.stringify(movedIds(index, 1))} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  disabled={hasDirty || index === data.sites.length - 1}
                  aria-label="Descendre"
                >
                  <ArrowDownIcon size={16} />
                </Button>
              </form>
            </div>
          {/if}
          <div class="editor-main">
            <SiteEditor
              site={{ ...site, openingHours: site.openingIntervals }}
              {multiSite}
              bind:dirty={dirtySites[site.id]}
            />
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
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
  .section-help,
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
  .reorder-warning {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--warning-light);
    color: var(--warning);
    font-size: var(--text-small);
  }
  .section-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .section-actions {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .section-label {
    margin: 0 0 var(--space-1);
    color: var(--ludo-color);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .editors {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .editor-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .editor-main {
    min-width: 0;
    flex: 1;
  }
  .order-actions {
    display: flex;
    flex-direction: column;
    padding-top: var(--space-2);
  }
  .empty {
    padding: var(--space-8);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    text-align: center;
  }
  @media (max-width: 640px) {
    .head {
      flex-direction: column;
    }
    .section-head {
      align-items: flex-start;
      flex-direction: column;
    }
    .section-actions {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-2);
    }
  }
</style>
