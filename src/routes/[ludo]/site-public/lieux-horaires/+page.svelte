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
  <title>Lieux et horaires · Site public</title>
</svelte:head>

<main class="page-shell">
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
      {#if mode === 'preview'}<PencilIcon size={16} /> Gérer les lieux{:else}<EyeIcon size={16} /> Terminer{/if}
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
    <HoursPreview sites={previewSites} editable={data.canEdit} />
  </section>
{:else}
  <section aria-labelledby="edit-title">
    <div class="section-head">
      <div>
        <p class="section-label">Édition</p>
        <h2 id="edit-title">{multiSite ? 'Vos lieux' : 'Votre ludothèque'}</h2>
      </div>
      <div class="section-actions">
        <Button variant="outline" onclick={() => (creating = !creating)}>
          <PlusIcon size={16} />
          {creating ? 'Annuler' : 'Ajouter un lieu'}
        </Button>
      </div>
    </div>

    {#if creating}
      <SiteCreateForm oncreated={() => (creating = false)} />
    {/if}

    <div class="editors">
      {#each data.sites as site, index (site.id)}
        <div class="editor-row">
          <div class="editor-main">
            <SiteEditor
              site={{ ...site, openingHours: site.openingIntervals }}
              {multiSite}
              bind:dirty={dirtySites[site.id]}
            />
            {#if !site.isPrimary && !site.isActive}
              <form
                class="delete-site"
                method="POST"
                action="?/delete"
                onsubmit={(event) => {
                  if (!confirm(`Supprimer définitivement le lieu « ${site.name} » ?`)) {
                    event.preventDefault()
                  }
                }}
                use:enhance={toastEnhance({ success: 'Lieu supprimé.' })}
              >
                <input type="hidden" name="siteId" value={site.id} />
                <Button type="submit" variant="destructive" size="sm">Supprimer ce lieu</Button>
              </form>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if multiSite}
      <details class="reorder-settings">
        <summary>Modifier l’ordre d’affichage des lieux</summary>
        {#if hasDirty}
          <p class="reorder-help">Terminez d’abord l’enregistrement du lieu en cours, puis revenez ici pour modifier l’ordre.</p>
        {:else}
          <div class="reorder-list">
            {#each data.sites as site, index (site.id)}
              <div class="reorder-item">
                <span>{site.name}</span>
                <div>
                  <form method="POST" action="?/reorder" use:enhance={toastEnhance({ success: 'Ordre mis à jour.' })}>
                    <input type="hidden" name="orderedIds" value={JSON.stringify(movedIds(index, -1))} />
                    <Button type="submit" variant="ghost" size="icon" disabled={index === 0} aria-label={`Monter ${site.name}`}><ArrowUpIcon size={16} /></Button>
                  </form>
                  <form method="POST" action="?/reorder" use:enhance={toastEnhance({ success: 'Ordre mis à jour.' })}>
                    <input type="hidden" name="orderedIds" value={JSON.stringify(movedIds(index, 1))} />
                    <Button type="submit" variant="ghost" size="icon" disabled={index === data.sites.length - 1} aria-label={`Descendre ${site.name}`}><ArrowDownIcon size={16} /></Button>
                  </form>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </details>
    {/if}
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
  .editor-row { display: flex; align-items: flex-start; }
  .editor-main {
    min-width: 0;
    flex: 1;
  }
  .reorder-settings {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
  }
  .reorder-settings summary {
    min-height: 48px;
    padding: var(--space-3) var(--space-4);
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }
  .reorder-help { margin: 0; padding: 0 var(--space-4) var(--space-4); color: var(--text-muted); font-size: var(--text-small); }
  .reorder-list { display: grid; gap: var(--space-2); padding: 0 var(--space-4) var(--space-4); }
  .reorder-item { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--bg-hover); color: var(--text-main); font-size: var(--text-small); }
  .reorder-item > div, .reorder-item form { display: flex; align-items: center; gap: var(--space-1); }
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
    .section-actions {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-2);
    }
  }
  .delete-site {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-2);
  }
</style>
