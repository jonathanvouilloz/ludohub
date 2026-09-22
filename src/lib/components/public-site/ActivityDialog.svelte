<script lang="ts" module>
  export type EditableActivity = {
    id: string
    revision: number
    slug: string
    title: string
    summary: string
    body: string
    location: string | null
    type: 'one_off' | 'recurring' | 'permanent'
    imageUrl: string | null
    imageAlt: string | null
    status: 'draft' | 'published' | 'hidden'
    lifecycle: 'active' | 'archived' | 'trashed'
    featuredRank: number | null
    assets: Array<{
      id: string
      kind: 'support_image' | 'pdf_attachment'
      url: string
      fileName: string | null
      caption: string | null
      alt: string | null
    }>
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import {
    compressEditorialImageEntries,
    compressEditorialImageFields,
    compressEditorialPdfFields,
  } from '$lib/media/editorial-image.js'
  import RichTextEditor from './RichTextEditor.svelte'
  import { toastEnhance } from '$lib/utils/enhance.js'
  let {
    open = $bindable(false),
    activity = null,
  }: { open?: boolean; activity?: EditableActivity | null } = $props()
  let title = $state(''),
    summary = $state(''),
    body = $state(''),
    location = $state('')
  let type = $state<EditableActivity['type']>('one_off'),
    visible = $state(true)
  let submitting = $state(false),
    submitError = $state('')
  const isEdit = $derived(activity !== null)
  const contentImages = $derived(
    activity?.assets.filter((asset) => asset.kind === 'support_image') ?? [],
  )
  $effect(() => {
    if (!open) return
    title = activity?.title ?? ''
    summary = activity?.summary ?? ''
    body = activity?.body ?? ''
    location = activity?.location ?? ''
    type = activity?.type ?? 'one_off'
    visible = activity ? activity.status === 'published' : true
    submitError = ''
  })
</script>

<Dialog.Root bind:open
  ><Dialog.Content class="activity-dialog"
    ><Dialog.Header
      ><Dialog.Title>{isEdit ? 'Modifier l’activité' : 'Nouvelle activité'}</Dialog.Title
      ><Dialog.Description
        >Décrivez l’activité dans un seul formulaire. Les dates, horaires et exceptions s’écrivent
        librement dans la description.</Dialog.Description
      ></Dialog.Header
    >
    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      enctype="multipart/form-data"
      use:enhance={toastEnhance({
        success: isEdit ? 'Activité mise à jour.' : 'Activité créée.',
        errorMode: 'inline',
        prepare: async (formData) => {
          await Promise.all([
            compressEditorialImageFields(formData, ['coverFile'], 'content'),
            compressEditorialImageEntries(formData, 'contentImageFiles', 'gallery'),
            compressEditorialPdfFields(formData, ['attachmentFile']),
          ])
        },
        onPending: (pending) => {
          submitting = pending
          if (pending) submitError = ''
        },
        onError: (message) => (submitError = message),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}<input type="hidden" name="id" value={activity?.id} /><input
          type="hidden"
          name="revision"
          value={activity?.revision}
        />{:else}<input type="hidden" name="targetMode" value="all" /><input
          type="hidden"
          name="slug"
          value={title}
        />{/if}
      <div class="field">
        <Label for="activity-title">Titre</Label><Input
          id="activity-title"
          name="title"
          bind:value={title}
          maxlength={180}
          required
        />
      </div>
      <div class="field">
        <Label for="activity-summary">Résumé</Label><textarea
          id="activity-summary"
          name="summary"
          bind:value={summary}
          rows="3"
          required
        ></textarea>
      </div>
      <div class="field">
        <Label for="activity-body">Description</Label>
        <p class="hint">Indiquez ici les dates, horaires, périodes et éventuelles exceptions.</p>
        <RichTextEditor
          id="activity-body"
          name="body"
          bind:value={body}
          ariaLabel="Description de l’activité"
          placeholder="Décrivez l’activité et ses informations pratiques…"
        />
      </div>
      <div class="field">
        <Label for="activity-location">Lieu ou précision pratique</Label><Input
          id="activity-location"
          name="location"
          bind:value={location}
        />
      </div>
      <fieldset>
        <legend>Rythme</legend>
        <div class="mode-grid">
          <label
            ><input type="radio" name="type" value="one_off" bind:group={type} /> Ponctuelle</label
          ><label
            ><input type="radio" name="type" value="recurring" bind:group={type} /> Récurrente</label
          ><label
            ><input type="radio" name="type" value="permanent" bind:group={type} /> Permanente</label
          >
        </div>
      </fieldset>
      <fieldset>
        <legend>Publication</legend><label class="visibility-choice"
          ><input type="checkbox" name="visible" value="true" bind:checked={visible} /><span
            ><strong>Visible sur le site</strong><small
              >{visible
                ? 'L’activité sera publiée dès son enregistrement.'
                : 'L’activité restera cachée du site.'}</small
            ></span
          ></label
        >
      </fieldset>
      <fieldset>
        <legend>Images et document</legend>
        <p class="hint">Tous ces ajouts sont facultatifs.</p>
        <div class="field">
          <Label for="activity-cover-file">Image</Label>{#if activity?.imageUrl}<img
              class="image-preview"
              src={activity.imageUrl}
              alt={activity.imageAlt ?? ''}
            />{/if}<input
            id="activity-cover-file"
            type="file"
            name="coverFile"
            accept="image/jpeg,image/png,image/webp"
          /><Input
            name="coverAlt"
            value={activity?.imageAlt ?? ''}
            maxlength={300}
            placeholder="Description de l’image"
          />{#if activity?.imageUrl}<label class="remove-choice"
              ><input type="checkbox" name="removeCover" /> Retirer l’image</label
            >{/if}
        </div>
        <div class="field">
          <Label for="activity-content-images">Images complémentaires</Label><input
            id="activity-content-images"
            type="file"
            name="contentImageFiles"
            accept="image/jpeg,image/png,image/webp"
            multiple
          /><Input
            name="contentImagesAlt"
            maxlength={300}
            placeholder="Description des images"
          />{#if contentImages.length}<div class="image-list">
              {#each contentImages as image (image.id)}<label class="media-item"
                  ><img src={image.url} alt={image.alt ?? ''} /><span
                    ><input type="checkbox" name="removeAssetIds" value={image.id} /> Retirer cette image</span
                  ></label
                >{/each}
            </div>{/if}
        </div>
        <div class="field">
          <Label for="activity-attachment-file">Document PDF</Label><input
            id="activity-attachment-file"
            type="file"
            name="attachmentFile"
            accept="application/pdf"
          /><Input
            name="attachmentTitle"
            maxlength={500}
            placeholder="Titre du document"
          />{#if activity?.assets.filter((asset) => asset.kind === 'pdf_attachment').length}<ul
              class="attachments"
            >
              {#each activity.assets.filter((asset) => asset.kind === 'pdf_attachment') as attachment (attachment.id)}<li
                >
                  <label class="remove-choice"
                    ><input type="checkbox" name="removeAssetIds" value={attachment.id} /> Retirer « {attachment.caption ??
                      attachment.fileName} »</label
                  >
                </li>{/each}
            </ul>{/if}
        </div>
      </fieldset>
      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}<Dialog.Footer
        ><Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button
        ><Button
          type="submit"
          disabled={submitting || !title.trim() || !summary.trim() || !body.trim()}
          >{submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer l’activité'}</Button
        ></Dialog.Footer
      >
    </form></Dialog.Content
  ></Dialog.Root
>

<style>
  :global(.activity-dialog) {
    max-width: 780px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .field,
  fieldset {
    display: grid;
    gap: var(--space-2);
    margin: 0 0 var(--space-4);
  }
  fieldset {
    padding: 0;
    border: 0;
  }
  legend,
  label span {
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
  }
  textarea {
    resize: vertical;
  }
  .mode-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .mode-grid label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  .visibility-choice,
  .remove-choice,
  .media-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .visibility-choice {
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .visibility-choice span {
    display: grid;
    gap: var(--space-1);
  }
  .visibility-choice small {
    color: var(--text-muted);
  }
  input[type='file'] {
    width: 100%;
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
  }
  .image-preview {
    width: min(100%, 460px);
    max-height: 220px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  .image-list,
  .attachments {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .media-item {
    align-items: center;
  }
  .media-item img {
    width: 72px;
    height: 54px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
</style>
