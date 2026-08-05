<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import ActivityDialog, {
    type EditableActivity,
  } from '$lib/components/public-site/ActivityDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import CalendarIcon from '@lucide/svelte/icons/calendar-days'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  let dialogOpen = $state(false)
  let editing = $state<EditableActivity | null>(null)
  let pendingId = $state<string | null>(null)
  let imagePendingId = $state<string | null>(null)

  function openCreate() {
    editing = null
    dialogOpen = true
  }

  function openEdit(activity: EditableActivity) {
    editing = activity
    dialogOpen = true
  }

  function hasInactiveTargets(activity: EditableActivity) {
    return activity.targets.some((target) => !target.site.isActive)
  }

  function targetLabel(activity: EditableActivity) {
    if (activity.targets.length === 0) return 'Tous les lieux actifs'
    return activity.targets
      .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
      .join(', ')
  }

  function scheduleLabel(activity: EditableActivity) {
    if (activity.type === 'permanent') return 'Activité permanente'
    const occurrences = `${activity.dates.length} occurrence${activity.dates.length > 1 ? 's' : ''}`
    if (activity.type === 'one_off') return occurrences
    return `${occurrences} · récurrence · ${activity.exceptions.length} exception${activity.exceptions.length > 1 ? 's' : ''}`
  }
</script>

<svelte:head><title>Activités · {data.ludo.name}</title></svelte:head>

<main class="activities-page">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>Activités</h1>
      <p class="intro">Gérez les activités, leurs occurrences et leur visibilité.</p>
    </div>
    <Button onclick={openCreate}>Nouvelle activité</Button>
  </header>

  {#if page.form && 'error' in page.form && page.form.error}
    <p class="error" role="alert">{page.form.error}</p>
  {/if}

  {#if data.activities.length === 0}
    <EmptyState
      icon={CalendarIcon}
      title="Aucune activité"
      description="Créez un brouillon, ajoutez ses dates puis publiez-le."
    >
      {#snippet action()}<Button onclick={openCreate}>Nouvelle activité</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each data.activities as item (item.id)}
        <article
          class="activity-card"
          class:muted={item.status !== 'published' || item.lifecycle !== 'active'}
        >
          <div class="card-head">
            <div>
              <h2>{item.title}</h2>
              <p class="meta">/{item.slug} · {scheduleLabel(item)}</p>
              <p class="meta">{targetLabel(item)}{item.location ? ` · ${item.location}` : ''}</p>
            </div>
            <div class="badges">
              {#if item.status === 'published'}
                <Badge variant="success">Publiée</Badge>
              {:else if item.status === 'hidden'}
                <Badge variant="secondary">Masquée</Badge>
              {:else}
                <Badge variant="outline">Brouillon</Badge>
              {/if}
              {#if item.lifecycle === 'archived'}
                <Badge variant="secondary">Archivée</Badge>
              {:else if item.lifecycle === 'trashed'}
                <Badge variant="warning">Corbeille</Badge>
              {/if}
              {#if item.featuredRank}<Badge variant="outline">À la une n° {item.featuredRank}</Badge
                >{/if}
              {#if hasInactiveTargets(item)}<Badge variant="warning">Cible inactive</Badge>{/if}
            </div>
          </div>

          <p class="summary">{item.summary}</p>
          {#if item.imageUrl}<img
              class="cover"
              src={item.imageUrl}
              alt={item.imageAlt ?? ''}
            />{/if}
          {#if hasInactiveTargets(item)}
            <p class="warning" role="alert">
              Cette activité cible un lieu inactif. Corrigez son ciblage avant de la publier.
            </p>
          {/if}

          {#if item.lifecycle === 'active'}
            <div class="controls">
              <Button variant="outline" size="sm" onclick={() => openEdit(item)}>
                <PencilIcon size={16} aria-hidden="true" /> Modifier
              </Button>
              <form
                method="POST"
                action="?/publication"
                use:enhance={toastEnhance({
                  success: item.status === 'published' ? 'Activité masquée.' : 'Activité publiée.',
                  onPending: (value) => (pendingId = value ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="revision" value={item.revision} />
                <input
                  type="hidden"
                  name="status"
                  value={item.status === 'published' ? 'hidden' : 'published'}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant={item.status === 'published' ? 'outline' : 'default'}
                  disabled={pendingId === item.id ||
                    (item.status !== 'published' && hasInactiveTargets(item))}
                >
                  {item.status === 'published' ? 'Masquer' : 'Publier'}
                </Button>
              </form>
              <form
                class="feature"
                method="POST"
                action="?/feature"
                use:enhance={toastEnhance({
                  success: 'Mise en avant mise à jour.',
                  onPending: (value) => (pendingId = value ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="revision" value={item.revision} />
                <label
                  >À la une
                  <select
                    name="rank"
                    disabled={item.status !== 'published' || pendingId === item.id}
                  >
                    <option value="" selected={item.featuredRank === null}>Non</option>
                    {#each [1, 2, 3] as rank}<option
                        value={rank}
                        selected={item.featuredRank === rank}>Rang {rank}</option
                      >{/each}
                  </select>
                </label>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={item.status !== 'published' || pendingId === item.id}>Appliquer</Button
                >
              </form>
            </div>
          {/if}

          <div class="lifecycle">
            {#if item.lifecycle !== 'active'}
              <form
                method="POST"
                action="?/lifecycle"
                use:enhance={toastEnhance({ success: 'Activité restaurée.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><input type="hidden" name="lifecycle" value="active" />
                <Button type="submit" size="sm" variant="outline">Restaurer</Button>
              </form>
            {/if}
            {#if item.lifecycle === 'active'}
              <form
                method="POST"
                action="?/lifecycle"
                use:enhance={toastEnhance({ success: 'Activité archivée.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><input type="hidden" name="lifecycle" value="archived" />
                <Button type="submit" size="sm" variant="outline">Archiver</Button>
              </form>
            {/if}
            {#if item.lifecycle !== 'trashed'}
              <form
                method="POST"
                action="?/lifecycle"
                use:enhance={toastEnhance({ success: 'Activité placée dans la corbeille.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><input type="hidden" name="lifecycle" value="trashed" />
                <Button type="submit" size="sm" variant="outline">Corbeille</Button>
              </form>
            {:else}
              <form
                method="POST"
                action="?/delete"
                onsubmit={(event) => {
                  if (!confirm('Supprimer définitivement cette activité ?')) event.preventDefault()
                }}
                use:enhance={toastEnhance({ success: 'Activité supprimée.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                />
                <Button type="submit" size="sm" variant="destructive"
                  >Supprimer définitivement</Button
                >
              </form>
            {/if}
          </div>

          {#if item.lifecycle === 'active'}
            <section class="image-editor" aria-label={`Image de ${item.title}`}>
              <form
                method="POST"
                action="?/uploadImage"
                enctype="multipart/form-data"
                use:enhance={toastEnhance({
                  success: item.imageUrl ? 'Image remplacée.' : 'Image ajoutée.',
                  onPending: (value) => (imagePendingId = value ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                />
                <label
                  ><span>Fichier JPEG, PNG ou WebP</span><input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  /></label
                >
                <label
                  ><span>Texte alternatif</span><input
                    type="text"
                    name="alt"
                    value={item.imageAlt ?? ''}
                    maxlength="300"
                    required
                  /></label
                >
                <Button type="submit" size="sm" disabled={imagePendingId === item.id}
                  >{item.imageUrl ? 'Remplacer' : 'Ajouter'}</Button
                >
              </form>
              {#if item.imageUrl}
                <form
                  method="POST"
                  action="?/removeImage"
                  use:enhance={toastEnhance({
                    success: 'Image supprimée.',
                    onPending: (value) => (imagePendingId = value ? item.id : null),
                  })}
                >
                  <input type="hidden" name="id" value={item.id} /><input
                    type="hidden"
                    name="revision"
                    value={item.revision}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={imagePendingId === item.id}>Supprimer l’image</Button
                  >
                </form>
              {/if}
            </section>
          {/if}
        </article>
      {/each}
    </div>
  {/if}

  <ActivityDialog bind:open={dialogOpen} activity={editing} sites={data.sites} />
</main>

<style>
  .activities-page {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  .card-head,
  .controls,
  .lifecycle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  header {
    align-items: flex-end;
    margin-bottom: var(--space-6);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .eyebrow,
  .intro,
  .meta {
    color: var(--text-muted);
  }
  .eyebrow {
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h1 {
    margin-top: var(--space-1);
    font-size: var(--text-h1);
  }
  h2 {
    font-size: var(--text-card-title);
  }
  .meta {
    margin-top: var(--space-1);
    font-size: var(--text-small);
  }
  .list {
    display: grid;
    gap: var(--space-4);
  }
  .activity-card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  .activity-card.muted {
    border-style: dashed;
  }
  .badges,
  .controls,
  .lifecycle {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .summary {
    line-height: 1.6;
  }
  .cover {
    width: min(100%, 560px);
    max-height: 280px;
    border-radius: var(--radius-md);
    object-fit: cover;
  }
  .warning,
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .warning {
    background: var(--warning-light);
  }
  .error {
    margin-bottom: var(--space-4);
    background: var(--danger-light);
    color: var(--danger);
  }
  .controls,
  .lifecycle,
  .image-editor {
    justify-content: flex-start;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .controls form,
  .lifecycle form,
  .feature {
    display: inline-flex;
    align-items: flex-end;
    gap: var(--space-2);
  }
  .feature label {
    display: grid;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  select,
  .image-editor input {
    min-height: 40px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  .image-editor {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .image-editor form:first-child {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    flex: 1;
  }
  .image-editor label {
    display: grid;
    gap: var(--space-1);
    flex: 1;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .image-editor input {
    width: 100%;
  }
  @media (max-width: 640px) {
    .activities-page {
      padding: var(--space-6) var(--space-4);
    }
    header,
    .card-head,
    .controls,
    .lifecycle,
    .image-editor,
    .image-editor form:first-child {
      align-items: stretch;
      flex-direction: column;
    }
    .badges {
      justify-content: flex-start;
    }
    header :global(button),
    .controls :global(button),
    .lifecycle :global(button),
    .image-editor :global(button) {
      width: 100%;
    }
  }
</style>
