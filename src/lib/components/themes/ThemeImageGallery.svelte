<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import { Button } from '$lib/components/ui/button/index.js'

  type ThemeImage = { id: string; url: string }

  let { themeId, images, editable }: { themeId: string; images: ThemeImage[]; editable: boolean } =
    $props()

  const MAX = 3
  let fileInput = $state<HTMLInputElement | null>(null)
  let uploading = $state(false)
  let error = $state('')

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
</script>

<div class="gallery">
  <div class="grid">
    {#each images as image (image.id)}
      <figure>
        <img src={image.url} alt="" />
        {#if editable}
          <button
            type="button"
            class="remove"
            onclick={() => onDelete(image.id)}
            aria-label="Supprimer la photo">×</button
          >
        {/if}
      </figure>
    {/each}
    {#if images.length === 0}
      <p class="empty">Aucune photo.</p>
    {/if}
  </div>

  {#if editable}
    <div class="upload">
      <input
        bind:this={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onchange={onUpload}
      />
      <Button
        type="button"
        variant="outline"
        disabled={atMax || uploading}
        onclick={() => fileInput?.click()}
      >
        {uploading ? 'Envoi…' : atMax ? `Maximum ${MAX} photos` : 'Ajouter une photo'}
      </Button>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
  {/if}
</div>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    gap: var(--space-3);
  }
  figure {
    position: relative;
    margin: 0;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border);
  }
  figure img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
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
  .empty {
    color: var(--text-subtle);
    font-style: italic;
    margin: 0;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: var(--text-small);
  }
</style>
