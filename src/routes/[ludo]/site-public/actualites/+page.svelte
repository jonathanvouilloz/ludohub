<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import NewsDialog, { type EditableNews } from '$lib/components/public-site/NewsDialog.svelte'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import NewspaperIcon from '@lucide/svelte/icons/newspaper'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  let dialogOpen = $state(false)
  let editing = $state<EditableNews | null>(null)
  let transitioningId = $state<string | null>(null)
  let imagePendingId = $state<string | null>(null)

  function openCreate() {
    editing = null
    dialogOpen = true
  }

  function openEdit(news: EditableNews) {
    editing = news
    dialogOpen = true
  }

  function hasInactiveTargets(news: EditableNews) {
    return news.targets.some((target) => !target.site.isActive)
  }

  function targetLabel(news: EditableNews) {
    if (news.targets.length === 0) return 'Tous les lieux actifs'
    return news.targets
      .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
      .join(', ')
  }
</script>

<svelte:head><title>Actualités · {data.ludo.name}</title></svelte:head>

<main class="news-page">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>Actualités</h1>
      <p class="intro">Préparez les articles Markdown publiés sur le site.</p>
    </div>
    <Button onclick={openCreate}>Nouvelle actualité</Button>
  </header>

  {#if page.form && 'error' in page.form && page.form.error}
    <p class="error" role="alert">{page.form.error}</p>
  {/if}

  {#if data.news.length === 0}
    <EmptyState
      icon={NewspaperIcon}
      title="Aucune actualité"
      description="Créez un brouillon avant de le publier sur le site."
    >
      {#snippet action()}<Button onclick={openCreate}>Nouvelle actualité</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each data.news as item (item.id)}
        <article class="news-card" class:muted={item.status !== 'published'}>
          <div class="card-head">
            <div>
              <h2>{item.title}</h2>
              <p class="slug">/{item.slug}</p>
              <p class="targets">{targetLabel(item)}</p>
            </div>
            <div class="badges">
              {#if item.status === 'published'}
                <Badge variant="success">Publiée</Badge>
              {:else if item.status === 'hidden'}
                <Badge variant="secondary">Masquée</Badge>
              {:else}
                <Badge variant="outline">Brouillon</Badge>
              {/if}
              {#if hasInactiveTargets(item)}
                <Badge variant="warning">Cible inactive</Badge>
              {/if}
            </div>
          </div>

          <p class="summary">{item.summary}</p>
          {#if item.imageUrl}
            <img class="cover" src={item.imageUrl} alt={item.imageAlt ?? ''} />
          {/if}
          {#if hasInactiveTargets(item)}
            <p class="target-warning" role="alert">
              Cette actualité cible un lieu inactif. Choisissez un nouveau ciblage avant de
              l’enregistrer ou de la publier.
            </p>
          {/if}

          <footer>
            <Button variant="outline" size="sm" onclick={() => openEdit(item)}>
              <PencilIcon size={16} aria-hidden="true" /> Modifier
            </Button>
            <form
              method="POST"
              action="?/transition"
              use:enhance={toastEnhance({
                success: item.status === 'published' ? 'Actualité masquée.' : 'Actualité publiée.',
                onPending: (pending) => (transitioningId = pending ? item.id : null),
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
                disabled={transitioningId === item.id ||
                  (item.status !== 'published' && hasInactiveTargets(item))}
              >
                {transitioningId === item.id
                  ? 'Enregistrement…'
                  : item.status === 'published'
                    ? 'Masquer'
                    : 'Publier'}
              </Button>
            </form>
          </footer>

          <section class="image-editor" aria-label={`Image de ${item.title}`}>
            <form
              method="POST"
              action="?/uploadImage"
              enctype="multipart/form-data"
              use:enhance={toastEnhance({
                success: item.imageUrl ? 'Image remplacée.' : 'Image ajoutée.',
                onPending: (pending) => (imagePendingId = pending ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="revision" value={item.revision} />
              <label>
                <span>Fichier JPEG, PNG ou WebP</span>
                <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
              </label>
              <label>
                <span>Texte alternatif</span>
                <input
                  type="text"
                  name="alt"
                  value={item.imageAlt ?? ''}
                  maxlength="300"
                  required
                />
              </label>
              <Button type="submit" size="sm" disabled={imagePendingId === item.id}>
                {imagePendingId === item.id
                  ? 'Envoi…'
                  : item.imageUrl
                    ? 'Remplacer l’image'
                    : 'Ajouter l’image'}
              </Button>
            </form>

            {#if item.imageUrl}
              <form
                method="POST"
                action="?/removeImage"
                use:enhance={toastEnhance({
                  success: 'Image supprimée.',
                  onPending: (pending) => (imagePendingId = pending ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="revision" value={item.revision} />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={imagePendingId === item.id}>Supprimer l’image</Button
                >
              </form>
            {/if}
          </section>
        </article>
      {/each}
    </div>
  {/if}

  <NewsDialog bind:open={dialogOpen} news={editing} sites={data.sites} />
</main>

<style>
  .news-page {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  .card-head,
  footer {
    display: flex;
    align-items: flex-start;
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
  .slug,
  .targets,
  .intro {
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
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-card-title);
  }
  .slug,
  .targets {
    margin-top: var(--space-1);
    font-size: var(--text-small);
  }
  .list {
    display: grid;
    gap: var(--space-4);
  }
  .news-card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  .news-card.muted {
    border-style: dashed;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .summary {
    color: var(--text-main);
    line-height: 1.6;
  }
  .cover {
    width: min(100%, 560px);
    max-height: 280px;
    border-radius: var(--radius-md);
    object-fit: cover;
  }
  .target-warning,
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .target-warning {
    background: var(--warning-light);
    color: var(--text-main);
  }
  .error {
    margin-bottom: var(--space-4);
    background: var(--danger-light);
    color: var(--danger);
  }
  footer {
    align-items: center;
    justify-content: flex-end;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  footer form {
    display: inline-flex;
  }
  .image-editor {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
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
  .image-editor input[type='text'],
  .image-editor input[type='file'] {
    width: 100%;
    min-height: 40px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  @media (max-width: 640px) {
    .news-page {
      padding: var(--space-6) var(--space-4);
    }
    header,
    .card-head {
      align-items: stretch;
      flex-direction: column;
    }
    header :global(button) {
      width: 100%;
    }
    .badges {
      justify-content: flex-start;
    }
    footer :global(button),
    footer form {
      flex: 1;
    }
    footer :global(button) {
      width: 100%;
    }
    .image-editor,
    .image-editor form:first-child {
      align-items: stretch;
      flex-direction: column;
    }
    .image-editor :global(button) {
      width: 100%;
    }
  }
</style>
