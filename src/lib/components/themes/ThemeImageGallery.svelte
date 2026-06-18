<script lang="ts">
  import { invalidateAll } from '$app/navigation'

  type ThemeImage = { id: string; url: string; isCover?: boolean }

  let { themeId, images, editable }: { themeId: string; images: ThemeImage[]; editable: boolean } =
    $props()

  const MAX = 6
  let fileInput = $state<HTMLInputElement | null>(null)
  let uploading = $state(false)
  let error = $state('')

  // Images déjà ordonnées cover-first côté serveur ; on reste défensif.
  const cover = $derived(images.find((i) => i.isCover) ?? images[0])
  const rest = $derived(images.filter((i) => i.id !== cover?.id))
  const atMax = $derived(images.length >= MAX)

  async function onUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    error = ''
    uploading = true
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/themes/${themeId}/images`, { method: 'POST', body })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        error = data?.message ?? 'Échec de l’upload.'
        return
      }
      await invalidateAll()
    } finally {
      uploading = false
      if (fileInput) fileInput.value = ''
    }
  }

  async function onDelete(imageId: string) {
    error = ''
    const res = await fetch(`/api/themes/${themeId}/images?imageId=${imageId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      error = data?.message ?? 'Échec de la suppression.'
      return
    }
    await invalidateAll()
  }

  async function onSetCover(imageId: string) {
    error = ''
    const res = await fetch(`/api/themes/${themeId}/images?imageId=${imageId}`, {
      method: 'PATCH',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      error = data?.message ?? 'Échec de la définition de la couverture.'
      return
    }
    await invalidateAll()
  }
</script>

<div class="gallery">
  <!-- Couverture : grande vignette 16:9 = ce qui s'affiche dans les cartes. -->
  <div class="cover-block">
    <span class="label">Couverture</span>
    {#if cover}
      <figure class="cover">
        <img src={cover.url} alt="" />
        {#if editable}
          <button
            type="button"
            class="remove"
            onclick={() => onDelete(cover.id)}
            aria-label="Supprimer la couverture">×</button
          >
        {/if}
      </figure>
    {:else if editable}
      <button
        type="button"
        class="cover-dropzone"
        disabled={uploading}
        onclick={() => fileInput?.click()}
      >
        <span class="plus" aria-hidden="true">+</span>
        {uploading ? 'Envoi…' : 'Ajouter une couverture'}
      </button>
    {:else}
      <div class="cover empty"><span aria-hidden="true">🎲</span></div>
    {/if}
  </div>

  <!-- Photos d'appoint : vignettes secondaires pour présenter le thème. -->
  {#if editable || rest.length > 0}
    <div class="appoint">
      <span class="label">Photos d'appoint</span>
      <div class="grid">
        {#each rest as image (image.id)}
          <figure class="thumb">
            <img src={image.url} alt="" />
            {#if editable}
              <button
                type="button"
                class="remove"
                onclick={() => onDelete(image.id)}
                aria-label="Supprimer la photo">×</button
              >
              <button type="button" class="set-cover" onclick={() => onSetCover(image.id)}>
                En couverture
              </button>
            {/if}
          </figure>
        {/each}

        {#if editable && !atMax}
          <button
            type="button"
            class="tile-dropzone"
            disabled={uploading}
            onclick={() => fileInput?.click()}
          >
            <span class="plus" aria-hidden="true">+</span>
            {uploading ? 'Envoi…' : 'Ajouter'}
          </button>
        {/if}
      </div>
    </div>
  {/if}

  {#if editable}
    <input
      bind:this={fileInput}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      onchange={onUpload}
    />
    {#if atMax}<p class="hint">Maximum {MAX} photos (1 couverture + {MAX - 1} d'appoint).</p>{/if}
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .label {
    display: block;
    margin-bottom: var(--space-2);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: var(--text-subtle);
  }
  /* ── Couverture ── */
  .cover {
    position: relative;
    margin: 0;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cover.empty {
    display: grid;
    place-items: center;
    background: var(--bg-hover);
    font-size: 2rem;
    opacity: 0.5;
  }
  .cover-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    aspect-ratio: 16 / 9;
    font: inherit;
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: var(--text-muted);
    background: var(--bg-hover);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition:
      border-color var(--dur-fast) ease,
      color var(--dur-fast) ease;
  }
  .cover-dropzone:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }
  /* ── Appoint ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: var(--space-3);
  }
  .thumb {
    position: relative;
    margin: 0;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .set-cover {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: var(--space-1) var(--space-2);
    border: none;
    font: inherit;
    font-size: var(--text-small);
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--dur-fast) ease;
  }
  .thumb:hover .set-cover,
  .set-cover:focus-visible {
    opacity: 1;
  }
  .tile-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    aspect-ratio: 1;
    font: inherit;
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: var(--text-muted);
    background: var(--bg-hover);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      border-color var(--dur-fast) ease,
      color var(--dur-fast) ease;
  }
  .tile-dropzone:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }
  .cover-dropzone:disabled,
  .tile-dropzone:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  /* ── Commun ── */
  .remove {
    position: absolute;
    top: var(--space-1);
    right: var(--space-1);
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .plus {
    font-size: 1.25rem;
    line-height: 1;
  }
  .hint {
    margin: 0;
    color: var(--text-subtle);
    font-size: var(--text-small);
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: var(--text-small);
  }
</style>
