<script lang="ts" module>
  export type GallerySite = { id: string; name: string; isActive: boolean }
  export type EditableGalleryItem = {
    id: string
    revision: number
    caption: string | null
    alt: string | null
    sortOrder: number
    status: 'draft' | 'published' | 'hidden'
    imageUrl: string | null
    targets: Array<{ siteId: string; site: GallerySite }>
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  let {
    open = $bindable(false),
    item = null,
    sites,
  }: { open?: boolean; item?: EditableGalleryItem | null; sites: GallerySite[] } = $props()
  let caption = $state(''),
    alt = $state(''),
    sortOrder = $state(0),
    targetMode = $state<'all' | 'explicit'>('all'),
    selectedSiteIds = $state<string[]>([]),
    submitting = $state(false),
    submitError = $state('')
  const isEdit = $derived(item !== null)
  $effect(() => {
    if (!open) return
    caption = item?.caption ?? ''
    alt = item?.alt ?? ''
    sortOrder = item?.sortOrder ?? 0
    targetMode = item && item.targets.length ? 'explicit' : 'all'
    selectedSiteIds = item?.targets.filter((x) => x.site.isActive).map((x) => x.siteId) ?? []
    submitError = ''
  })
</script>

<Dialog.Root bind:open
  ><Dialog.Content class="gallery-dialog"
    ><Dialog.Header
      ><Dialog.Title>{isEdit ? 'Modifier la photo' : 'Nouvelle photo'}</Dialog.Title
      ><Dialog.Description
        >Préparez les textes et le ciblage. L’image est ajoutée après création.</Dialog.Description
      ></Dialog.Header
    >
    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Photo mise à jour.' : 'Brouillon créé.',
        errorMode: 'inline',
        onPending: (v) => {
          submitting = v
          if (v) submitError = ''
        },
        onError: (m) => (submitError = m),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}<input type="hidden" name="id" value={item?.id} /><input
          type="hidden"
          name="revision"
          value={item?.revision}
        />{/if}
      <div class="field">
        <Label for="gallery-caption">Légende</Label><Input
          id="gallery-caption"
          name="caption"
          bind:value={caption}
          maxlength={500}
          required
        />
      </div>
      <div class="field">
        <Label for="gallery-alt">Texte alternatif</Label><Input
          id="gallery-alt"
          name="alt"
          bind:value={alt}
          maxlength={300}
          required
        />
      </div>
      <div class="field small">
        <Label for="gallery-order">Ordre</Label><Input
          id="gallery-order"
          name="sortOrder"
          type="number"
          bind:value={sortOrder}
          min={0}
          step={1}
          required
        />
      </div>
      <fieldset>
        <legend>Lieux concernés</legend>
        <div class="modes">
          <label
            ><input type="radio" name="targetMode" value="all" bind:group={targetMode} /> Tous les lieux
            actifs</label
          ><label
            ><input type="radio" name="targetMode" value="explicit" bind:group={targetMode} /> Lieux précis</label
          >
        </div>
        {#if targetMode === 'explicit'}<div class="sites">
            {#each sites as site (site.id)}<label class:disabled={!site.isActive}
                ><input
                  type="checkbox"
                  name="siteIds"
                  value={site.id}
                  bind:group={selectedSiteIds}
                  disabled={!site.isActive}
                />{site.name}{site.isActive ? '' : ' — inactif'}</label
              >{/each}
          </div>{/if}{#if targetMode === 'explicit' && !selectedSiteIds.length}<p class="warning">
            Sélectionnez au moins un lieu actif.
          </p>{/if}
      </fieldset>
      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}<Dialog.Footer
        ><Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button
        ><Button
          type="submit"
          disabled={submitting ||
            !caption.trim() ||
            !alt.trim() ||
            (targetMode === 'explicit' && !selectedSiteIds.length)}
          >{submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le brouillon'}</Button
        ></Dialog.Footer
      >
    </form></Dialog.Content
  ></Dialog.Root
>

<style>
  :global(.gallery-dialog) {
    max-width: 680px;
    max-height: 90vh;
    overflow-y: auto;
  }
  form,
  .field,
  fieldset {
    display: grid;
    gap: var(--space-3);
  }
  form {
    gap: var(--space-5);
  }
  .small {
    max-width: 180px;
  }
  fieldset {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  legend {
    padding: 0 var(--space-2);
    font-weight: var(--weight-semibold);
  }
  .modes,
  .sites {
    display: grid;
    gap: var(--space-2);
  }
  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .field :global(label) {
    display: block;
  }
  .disabled {
    color: var(--text-muted);
  }
  .warning,
  .error {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
  }
  .warning {
    background: var(--warning-light);
  }
  .error {
    background: var(--danger-light);
    color: var(--danger);
  }
</style>
