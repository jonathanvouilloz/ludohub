<script lang="ts" module>
  export type NewsFormValue = {
    id: string
    revision: number
    slug: string
    title: string
    summary: string
    body: string
    status: 'draft' | 'published' | 'hidden'
    imageUrl: string | null
    imageAlt: string | null
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
  import { goto } from '$app/navigation'
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import {
    compressEditorialImageFields,
    compressEditorialPdfFields,
  } from '$lib/media/editorial-image.js'
  import RichTextEditor from './RichTextEditor.svelte'
  import { toastEnhance } from '$lib/utils/enhance.js'

  let {
    news = null,
    action,
    cancelHref,
    successHref,
  }: {
    news?: NewsFormValue | null
    action: string
    cancelHref: string
    successHref: string
  } = $props()
  const isEdit = $derived(news !== null)
  const supportImage = $derived(
    news?.assets.find((asset) => asset.kind === 'support_image') ?? null,
  )
  let title = $state('')
  let slug = $state('')
  let summary = $state('')
  let body = $state('')
  let visible = $state(true)
  let initializedFor = $state<string | null>(null)
  let submitting = $state(false)
  let submitError = $state('')

  $effect(() => {
    const key = news?.id ?? 'new'
    if (initializedFor === key) return
    title = news?.title ?? ''
    slug = news?.slug ?? ''
    summary = news?.summary ?? ''
    body = news?.body ?? ''
    visible = news ? news.status === 'published' : true
    initializedFor = key
  })

  function slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
  }
  function updateTitle(value: string) {
    title = value
    slug = slugify(value)
  }
</script>

<form
  method="POST"
  {action}
  enctype="multipart/form-data"
  use:enhance={toastEnhance({
    success: isEdit ? 'Actualité mise à jour.' : 'Actualité créée.',
    errorMode: 'inline',
    skipUpdate: true,
    prepare: async (formData) => {
      await Promise.all([
        compressEditorialImageFields(formData, ['coverFile', 'contentImageFile'], 'content'),
        compressEditorialPdfFields(formData, ['attachmentFile']),
      ])
    },
    onPending: (pending) => {
      submitting = pending
      if (pending) submitError = ''
    },
    onError: (message) => (submitError = message),
    onSuccess: () => goto(successHref),
  })}
>
  {#if isEdit}<input type="hidden" name="id" value={news?.id} /><input
      type="hidden"
      name="revision"
      value={news?.revision}
    />{/if}
  {#if !isEdit}
    <input type="hidden" name="targetMode" value="all" />
    <input type="hidden" name="slug" value={slug} />
  {/if}

  <section aria-labelledby="content-title">
    <div class="section-heading">
      <h2 id="content-title">Contenu</h2>
      <p>Les informations que les familles liront sur le site.</p>
    </div>
    <div class="field">
      <Label for="news-title">Titre</Label><Input
        id="news-title"
        name="title"
        value={title}
        oninput={(event) => updateTitle(event.currentTarget.value)}
        maxlength={180}
        required
      />
    </div>
    <div class="field">
      <Label for="news-summary">Résumé</Label><textarea
        id="news-summary"
        name="summary"
        bind:value={summary}
        maxlength="500"
        rows="3"
        required
      ></textarea>
      <p class="hint">Une ou deux phrases affichées dans la liste des actualités.</p>
    </div>
    <div class="field">
      <Label for="news-body">Texte de l’actualité</Label>
      <RichTextEditor
        id="news-body"
        name="body"
        bind:value={body}
        ariaLabel="Texte de l’actualité"
        placeholder="Rédigez le contenu complet de l’actualité."
      />
      <p class="hint">Mettez en forme le texte avec des titres, des listes et des liens.</p>
    </div>
  </section>

  <section aria-labelledby="publication-title">
    <div class="section-heading">
      <h2 id="publication-title">Publication</h2>
      <p>La date de publication est ajoutée automatiquement à la première mise en ligne.</p>
    </div>
    <label class="visibility-choice">
      <input type="checkbox" name="visible" value="true" bind:checked={visible} />
      <span>
        <strong>Visible sur le site</strong>
        <small
          >{visible
            ? 'L’actualité sera publiée dès son enregistrement.'
            : 'L’actualité sera enregistrée, mais restera cachée du site.'}</small
        >
      </span>
    </label>
  </section>

  <section aria-labelledby="media-title">
    <div class="section-heading">
      <h2 id="media-title">Images et document</h2>
      <p>Tous ces ajouts sont facultatifs.</p>
    </div>
    <div class="field">
      <Label for="news-cover-file">Image de couverture</Label>
      {#if news?.imageUrl}<img
          class="image-preview"
          src={news.imageUrl}
          alt={news.imageAlt ?? ''}
        />{/if}
      <input
        id="news-cover-file"
        type="file"
        name="coverFile"
        accept="image/jpeg,image/png,image/webp"
      />
      <Input
        name="coverAlt"
        value={news?.imageAlt ?? ''}
        maxlength={300}
        placeholder="Description de l’image"
      />
      {#if news?.imageUrl}<label class="remove-choice"
          ><input type="checkbox" name="removeCover" /> Retirer l’image de couverture</label
        >{/if}
    </div>
    <div class="field">
      <Label for="news-content-image-file">Image dans l’actualité</Label>
      {#if supportImage}
        <img class="image-preview" src={supportImage.url} alt={supportImage.alt ?? ''} />
      {/if}
      <input
        id="news-content-image-file"
        type="file"
        name="contentImageFile"
        accept="image/jpeg,image/png,image/webp"
      />
      <Input name="contentImageAlt" maxlength={300} placeholder="Description de l’image" />
      <p class="hint">Elle s’affiche sous le texte de l’actualité.</p>
      {#if supportImage}
        <label class="remove-choice"
          ><input type="checkbox" name="removeAssetIds" value={supportImage.id} /> Retirer cette image</label
        >
      {/if}
    </div>
    <div class="field">
      <Label for="news-attachment-file">Document PDF</Label>
      <input id="news-attachment-file" type="file" name="attachmentFile" accept="application/pdf" />
      <Input name="attachmentTitle" maxlength={500} placeholder="Titre du document" />
      <p class="hint">Le PDF est optimisé avant l’envoi.</p>
      {#if news?.assets.filter((asset) => asset.kind === 'pdf_attachment').length}
        <ul class="attachments">
          {#each news.assets.filter((asset) => asset.kind === 'pdf_attachment') as attachment (attachment.id)}
            <li>
              <label class="remove-choice"
                ><input type="checkbox" name="removeAssetIds" value={attachment.id} /> Retirer « {attachment.caption ??
                  attachment.fileName} »</label
              >
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>

  {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
  <footer>
    <Button href={cancelHref} variant="outline">Annuler et revenir</Button><Button
      type="submit"
      disabled={submitting || !title.trim() || !summary.trim() || !body.trim()}
      >{submitting
        ? 'Enregistrement…'
        : isEdit
          ? 'Enregistrer les modifications'
          : 'Créer l’actualité'}</Button
    >
  </footer>
</form>

<style>
  form {
    display: grid;
    gap: var(--space-5);
  }
  section {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  h2,
  p {
    margin: 0;
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
  }
  .section-heading p,
  .hint {
    color: var(--text-muted);
    line-height: 1.5;
  }
  .field {
    display: grid;
    gap: var(--space-2);
  }
  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    line-height: 1.5;
    resize: vertical;
  }
  textarea:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .hint {
    font-size: var(--text-small);
  }
  .visibility-choice {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-height: 44px;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .visibility-choice:focus-within {
    box-shadow: var(--shadow-focus);
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
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  .image-preview {
    width: min(100%, 460px);
    max-height: 260px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  .remove-choice {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    color: var(--text-muted);
  }
  .attachments {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
  @media (max-width: 640px) {
    section {
      padding: var(--space-4);
    }
    footer {
      align-items: stretch;
      flex-direction: column-reverse;
    }
    footer :global(a),
    footer :global(button) {
      width: 100%;
    }
  }
</style>
