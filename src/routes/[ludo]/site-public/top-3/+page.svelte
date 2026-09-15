<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import TopThreeDialog, {
    type EditableTopThree,
  } from '$lib/components/public-site/TopThreeDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import { compressEditorialImageFormData } from '$lib/media/editorial-image.js'
  import ListOrderedIcon from '@lucide/svelte/icons/list-ordered'
  import HouseIcon from '@lucide/svelte/icons/house'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  const selectedId = $derived(page.url.searchParams.get('item'))
  let dialogOpen = $state(false)
  let editing = $state<EditableTopThree | null>(null)
  let pendingId = $state<string | null>(null)
  let pendingMedia = $state<string | null>(null)

  function openCreate() {
    editing = null
    dialogOpen = true
  }
  function openEdit(topThree: EditableTopThree) {
    editing = topThree
    dialogOpen = true
  }
  function inactiveTargets(topThree: EditableTopThree) {
    return topThree.targets.some((target) => !target.site.isActive)
  }
  function targetLabel(topThree: EditableTopThree) {
    if (topThree.targets.length === 0) return 'Tous les lieux actifs'
    return topThree.targets
      .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
      .join(', ')
  }
</script>

<svelte:head><title>Top 3 · {data.ludo.name}</title></svelte:head>

<main class="top-three-page">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>Top 3</h1>
      <p class="intro">
        Composez des sélections éditoriales de trois jeux autour d’un thème libre.
      </p>
    </div>
    <Button onclick={openCreate}>Nouveau Top 3</Button>
  </header>

  {#if page.form && 'error' in page.form && page.form.error}<p class="error" role="alert">
      {page.form.error}
    </p>{/if}

  {#if data.topThrees.length === 0}
    <EmptyState
      icon={ListOrderedIcon}
      title="Aucun Top 3"
      description="Créez une première sélection de trois jeux."
    >
      {#snippet action()}<Button onclick={openCreate}>Nouveau Top 3</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each data.topThrees as item (item.id)}
        <article
          class="card"
          class:muted={item.status !== 'published'}
          class:compact={selectedId !== item.id}
        >
          <div class="card-head">
            <div>
              <h2><a href={selectedId === item.id ? '?' : `?item=${item.id}`}>{item.theme}</a></h2>
              <p class="targets">/{item.slug} · {targetLabel(item)}</p>
            </div>
            <div class="badges">
              {#if item.status === 'published'}<Badge variant="success">Publié</Badge>
              {:else if item.status === 'hidden'}<Badge variant="secondary">Masqué</Badge>
              {:else}<Badge variant="outline">Brouillon</Badge>{/if}
              {#if inactiveTargets(item)}<Badge variant="warning">Cible inactive</Badge>{/if}
              {#if item.isHomepage}<Badge variant="default"
                  ><HouseIcon size={14} aria-hidden="true" /> Sur l’accueil</Badge
                >{/if}
            </div>
          </div>
          <ol>
            {#each item.games as game, index (index)}
              <li>
                <div class="game-content">
                  {#if game.imageUrl}
                    <img src={game.imageUrl} alt={game.imageAlt ?? ''} />
                  {/if}
                  <div>
                    <strong>{game.name}</strong>
                    <p>{game.description}</p>
                  </div>
                </div>
                <div class="game-media">
                  <form
                    method="POST"
                    action="?/uploadGameImage"
                    enctype="multipart/form-data"
                    use:enhance={toastEnhance({
                      success: game.imageUrl ? 'Image du jeu remplacée.' : 'Image du jeu ajoutée.',
                      prepare: (formData) => compressEditorialImageFormData(formData, 'gallery'),
                      onPending: (value) => (pendingMedia = value ? `${item.id}-${index}` : null),
                    })}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="revision" value={item.revision} />
                    <input type="hidden" name="gameIndex" value={index} />
                    <label>
                      <span>Image du jeu #{index + 1}</span>
                      <input
                        type="file"
                        name="file"
                        accept="image/jpeg,image/png,image/webp"
                        required
                      />
                    </label>
                    <label>
                      <span>Description de l’image</span>
                      <input
                        type="text"
                        name="alt"
                        value={game.imageAlt ?? `Boîte du jeu ${game.name}`}
                        maxlength="300"
                        required
                      />
                    </label>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={pendingMedia === `${item.id}-${index}`}
                      >{pendingMedia === `${item.id}-${index}`
                        ? 'Envoi…'
                        : game.imageUrl
                          ? 'Remplacer'
                          : 'Ajouter l’image'}</Button
                    >
                  </form>
                  {#if game.imageUrl}
                    <form
                      method="POST"
                      action="?/removeGameImage"
                      use:enhance={toastEnhance({
                        success: 'Image du jeu retirée.',
                        onPending: (value) => (pendingMedia = value ? `${item.id}-${index}` : null),
                      })}
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="revision" value={item.revision} />
                      <input type="hidden" name="gameIndex" value={index} />
                      <Button type="submit" size="sm" variant="outline">Retirer</Button>
                    </form>
                  {/if}
                </div>
              </li>
            {/each}
          </ol>
          {#if inactiveTargets(item)}<p class="warning" role="alert">
              Ce Top 3 cible un lieu inactif. Corrigez le ciblage avant de publier.
            </p>{/if}
          <footer>
            <Button variant="outline" size="sm" onclick={() => openEdit(item)}
              ><PencilIcon size={16} aria-hidden="true" /> Modifier</Button
            >
            <form
              method="POST"
              action="?/publication"
              use:enhance={toastEnhance({
                success:
                  item.status === 'published'
                    ? item.isHomepage
                      ? 'Top 3 masqué et retiré de l’accueil.'
                      : 'Top 3 masqué.'
                    : 'Top 3 publié.',
                onPending: (value) => (pendingId = value ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              />
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
                  (item.status !== 'published' && inactiveTargets(item))}
              >
                {pendingId === item.id
                  ? 'Enregistrement…'
                  : item.status === 'published'
                    ? 'Masquer'
                    : 'Publier'}
              </Button>
            </form>
            {#if item.status === 'published'}
              <form
                method="POST"
                action="?/homepage"
                use:enhance={toastEnhance({
                  success: item.isHomepage
                    ? 'Top 3 retiré de l’accueil.'
                    : 'Top 3 affiché sur l’accueil.',
                  onPending: (value) => (pendingId = value ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="revision" value={item.revision} />
                <input type="hidden" name="isHomepage" value={item.isHomepage ? 'false' : 'true'} />
                <Button
                  type="submit"
                  size="sm"
                  variant={item.isHomepage ? 'outline' : 'default'}
                  disabled={pendingId === item.id}
                >
                  <HouseIcon size={16} aria-hidden="true" />
                  {pendingId === item.id
                    ? 'Enregistrement…'
                    : item.isHomepage
                      ? 'Retirer de l’accueil'
                      : 'Afficher sur l’accueil'}
                </Button>
              </form>
            {/if}
            <form
                method="POST"
                action="?/delete"
                onsubmit={(event) => {
                  if (!confirm('Supprimer définitivement ce Top 3 ?')) event.preventDefault()
                }}
                use:enhance={toastEnhance({ success: 'Top 3 supprimé.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                />
                <Button type="submit" size="sm" variant="destructive">Supprimer</Button>
            </form>
          </footer>
        </article>
      {/each}
    </div>
  {/if}
  <TopThreeDialog bind:open={dialogOpen} topThree={editing} sites={data.sites} />
</main>

<style>
  .top-three-page {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  .card-head,
  footer {
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
  .targets {
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
  .targets {
    margin-top: var(--space-1);
    font-size: var(--text-small);
  }
  .list {
    display: grid;
    gap: var(--space-4);
  }
  .card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  .card.muted {
    border-style: dashed;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  ol {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding-left: var(--space-6);
  }
  li p {
    margin-top: var(--space-1);
    color: var(--text-muted);
    line-height: 1.5;
  }
  .game-content {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-3);
  }
  .game-content img {
    width: 88px;
    height: 88px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  .game-media,
  .game-media form,
  .game-media label {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }
  .game-media {
    flex-wrap: wrap;
    margin-top: var(--space-3);
  }
  .game-media form:first-child {
    flex: 1;
  }
  .game-media label {
    min-width: 12rem;
    flex: 1;
    flex-direction: column;
    align-items: stretch;
    color: var(--text-muted);
    font-size: var(--text-label);
  }
  .game-media input {
    min-height: 40px;
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  footer {
    justify-content: flex-end;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
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
  @media (max-width: 640px) {
    .top-three-page {
      padding: var(--space-6) var(--space-4);
    }
    header,
    .card-head {
      align-items: stretch;
      flex-direction: column;
    }
    .badges {
      justify-content: flex-start;
    }
    header :global(button) {
      width: 100%;
    }
    .game-content {
      grid-template-columns: 1fr;
    }
    .game-media,
    .game-media form {
      align-items: stretch;
      flex-direction: column;
    }
  }
  .compact > :not(.card-head) {
    display: none;
  }
  h2 a {
    color: var(--text-main);
    text-decoration: none;
  }
  h2 a:hover {
    color: var(--primary);
    text-decoration: underline;
  }
</style>
