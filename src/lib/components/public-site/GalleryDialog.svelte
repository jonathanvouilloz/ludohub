<script lang="ts" module>
  export type EditableGalleryItem = {
    id: string
    revision: number
    caption: string | null
    imageUrl: string | null
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { compressEditorialImageFormData } from '$lib/media/editorial-image.js'
  import { toastEnhance } from '$lib/utils/enhance.js'

  let {
    open = $bindable(false),
    item = null,
  }: { open?: boolean; item?: EditableGalleryItem | null } = $props()
  let caption = $state('')
  let submitting = $state(false)
  let submitError = $state('')
  const isEdit = $derived(item !== null)

  $effect(() => {
    if (!open) return
    caption = item?.caption ?? ''
    submitError = ''
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="gallery-dialog">
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier la légende' : 'Ajouter une photo'}</Dialog.Title>
      <Dialog.Description>
        Ajoutez une image et sa légende. La description technique est créée automatiquement.
      </Dialog.Description>
    </Dialog.Header>
    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      enctype="multipart/form-data"
      use:enhance={toastEnhance({
        success: isEdit ? 'Légende mise à jour.' : 'Photo ajoutée à la galerie.',
        errorMode: 'inline',
        prepare: (formData) => compressEditorialImageFormData(formData, 'gallery'),
        onPending: (value) => {
          submitting = value
          if (value) submitError = ''
        },
        onError: (message) => (submitError = message),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}
        <input type="hidden" name="id" value={item?.id} />
        <input type="hidden" name="revision" value={item?.revision} />
      {:else}
        <div class="field">
          <Label for="gallery-image">Image</Label>
          <input
            id="gallery-image"
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </div>
      {/if}
      <div class="field">
        <Label for="gallery-caption">Légende</Label>
        <Input id="gallery-caption" name="caption" bind:value={caption} maxlength={500} required />
      </div>
      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting || !caption.trim()}
          >{submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter la photo'}</Button
        >
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.gallery-dialog) {
    max-width: 580px;
  }
  form,
  .field {
    display: grid;
    gap: var(--space-3);
  }
  form {
    gap: var(--space-5);
  }
  .field :global(label) {
    display: block;
  }
  input[type='file'] {
    width: 100%;
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
  }
  .error {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
</style>
