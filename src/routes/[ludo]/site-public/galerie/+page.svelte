<script lang="ts">
  import { enhance } from '$app/forms'
  import GalleryDialog, {
    type EditableGalleryItem,
  } from '$lib/components/public-site/GalleryDialog.svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import ImagesIcon from '@lucide/svelte/icons/images'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data, form } = $props()
  let open = $state(false)
  let editing = $state<EditableGalleryItem | null>(null)

  function create() {
    editing = null
    open = true
  }
  function edit(item: EditableGalleryItem) {
    editing = item
    open = true
  }
</script>

<svelte:head><title>Galerie · {data.ludo.name}</title></svelte:head>

<main>
  <header>
    <div>
      <p>Site public</p>
      <h1>Galerie</h1>
      <span>Ajoutez simplement une image et sa légende.</span>
    </div>
    <Button onclick={create}>Ajouter une photo</Button>
  </header>
  {#if form && 'error' in form && form.error}<p class="error" role="alert">{form.error}</p>{/if}
  {#if !data.galleryItems.length}
    <EmptyState icon={ImagesIcon} title="Aucune photo" description="Ajoutez votre première photo et sa légende.">
      {#snippet action()}<Button onclick={create}>Ajouter une photo</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="grid">
      {#each data.galleryItems as item (item.id)}
        <article>
          {#if item.imageUrl}
            <img src={item.imageUrl} alt={item.alt ?? item.caption ?? ''} />
          {:else}
            <div class="placeholder">Image indisponible</div>
          {/if}
          <div class="head">
            <h2>{item.caption || 'Photo sans légende'}</h2>
            <Button size="sm" variant="outline" onclick={() => edit(item)}>
              <PencilIcon size={16} aria-hidden="true" /> Modifier la légende
            </Button>
          </div>
          <form
            method="POST"
            action="?/delete"
            onsubmit={(event) => {
              if (!confirm('Supprimer définitivement cette image ?')) event.preventDefault()
            }}
            use:enhance={toastEnhance({ success: 'Image supprimée.' })}
          >
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="revision" value={item.revision} />
            <Button type="submit" size="sm" variant="destructive">Supprimer</Button>
          </form>
        </article>
      {/each}
    </div>
  {/if}
  <GalleryDialog bind:open item={editing} />
</main>

<style>
  main {
    max-width: var(--max-content);
    margin: auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
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
  header p,
  header span {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    align-items: stretch;
  }
  article {
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  img,
  .placeholder {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-md);
    object-fit: cover;
  }
  .placeholder {
    display: grid;
    place-items: center;
    background: var(--bg-muted);
    color: var(--text-muted);
  }
  h2 {
    font-size: var(--text-card-title);
    display: -webkit-box;
    overflow: hidden;
    min-height: calc(2 * 1.35em);
    line-clamp: 2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  form {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .error {
    margin: 0 0 var(--space-4);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  @media (max-width: 960px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 640px) {
    main {
      padding: var(--space-6) var(--space-4);
    }
    .grid {
      grid-template-columns: 1fr;
    }
    header,
    .head {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
