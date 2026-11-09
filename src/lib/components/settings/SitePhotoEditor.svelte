<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Button } from '$lib/components/ui/button/index.js'

  let {
    site,
  }: {
    site: {
      id: string
      name: string
      photoUrl?: string | null
      photoAlt?: string | null
      photoStorageKey?: string | null
    }
  } = $props()
  let saving = $state(false)
  let selected = $state(false)
</script>

<section class="photo-editor" aria-label={`Photo de ${site.name}`}>
  <form
    method="POST"
    action="?/uploadPhoto"
    enctype="multipart/form-data"
    use:enhance={toastEnhance({
      success: 'Photo enregistrée.',
      errorMode: 'inline',
      onPending: (pending) => (saving = pending),
      onSuccess: () => (selected = false),
    })}
  >
    <input type="hidden" name="siteId" value={site.id} />
    <input type="hidden" name="expectedPhotoStorageKey" value={site.photoStorageKey ?? ''} />
    <label for={`photo-${site.id}`}
      >{site.photoUrl ? 'Remplacer la photo' : 'Ajouter une photo du lieu'}</label
    >
    <input
      id={`photo-${site.id}`}
      type="file"
      name="photoFile"
      accept="image/jpeg,image/png,image/webp"
      required
      onchange={(event) => (selected = Boolean(event.currentTarget.files?.length))}
    />
    <p class="hint">
      JPEG, PNG ou WebP, 5 Mio maximum. Les proportions sont conservées sur le site.
    </p>
    <label for={`photo-alt-${site.id}`}>Description de la photo (facultatif)</label>
    <input
      id={`photo-alt-${site.id}`}
      name="photoAlt"
      maxlength="300"
      value={site.photoAlt ?? ''}
      placeholder={`Vue de ${site.name}`}
    />
    <Button type="submit" size="sm" disabled={saving || !selected}
      >{saving ? 'Enregistrement…' : 'Enregistrer la photo'}</Button
    >
  </form>
  {#if site.photoUrl}
    <form
      method="POST"
      action="?/removePhoto"
      use:enhance={toastEnhance({
        success: 'Photo retirée.',
        errorMode: 'inline',
        onPending: (pending) => (saving = pending),
      })}
    >
      <input type="hidden" name="siteId" value={site.id} />
      <input type="hidden" name="expectedPhotoStorageKey" value={site.photoStorageKey ?? ''} />
      <Button type="submit" size="sm" variant="outline" disabled={saving}>Retirer la photo</Button>
    </form>
  {/if}
</section>

<style>
  .photo-editor {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
  form {
    display: grid;
    gap: var(--space-2);
  }
  label {
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  input {
    min-width: 0;
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-label);
  }
</style>
