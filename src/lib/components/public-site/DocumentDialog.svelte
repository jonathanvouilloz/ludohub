<script lang="ts" module>
  export type DocumentSite = { id: string; name: string; isActive: boolean }
  export type EditableDocument = {
    id: string
    revision: number
    slug: string
    kind: 'mission' | 'statutes' | 'annual_report' | 'other'
    title: string
    summary: string | null
    bodyMarkdown: string | null
    year: number | null
    status: 'draft' | 'published' | 'hidden'
    publishedAt: Date | null
    pdfUrl: string | null
    pdfFileName: string | null
    targets: Array<{ siteId: string; site: DocumentSite }>
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
    document = null,
    sites,
  }: { open?: boolean; document?: EditableDocument | null; sites: DocumentSite[] } = $props()
  let kind = $state<EditableDocument['kind']>('other')
  let slug = $state('')
  let slugManuallyEdited = $state(false)
  let title = $state('')
  let summary = $state('')
  let body = $state('')
  let year = $state<number | undefined>(undefined)
  let targetMode = $state<'all' | 'explicit'>('all')
  let selectedSiteIds = $state<string[]>([])
  let submitting = $state(false)
  let submitError = $state('')
  const isEdit = $derived(document !== null)
  const slugEditable = $derived(!document?.publishedAt)

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
    if (slugEditable && !slugManuallyEdited) slug = slugify(value)
  }

  $effect(() => {
    if (!open) return
    kind = document?.kind ?? 'other'
    slug = document?.slug ?? ''
    slugManuallyEdited = document !== null
    title = document?.title ?? ''
    summary = document?.summary ?? ''
    body = document?.bodyMarkdown ?? ''
    year = document?.year ?? undefined
    targetMode = document && document.targets.length > 0 ? 'explicit' : 'all'
    selectedSiteIds =
      document?.targets.filter((target) => target.site.isActive).map((target) => target.siteId) ??
      []
    submitError = ''
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="document-dialog">
    <Dialog.Header
      ><Dialog.Title>{isEdit ? 'Modifier le document' : 'Nouveau document'}</Dialog.Title
      ><Dialog.Description
        >Présentez le document public. Le PDF est ajouté après création.</Dialog.Description
      ></Dialog.Header
    >
    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Document mis à jour.' : 'Brouillon créé.',
        errorMode: 'inline',
        onPending: (value) => {
          submitting = value
          if (value) submitError = ''
        },
        onError: (message) => (submitError = message),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}<input type="hidden" name="id" value={document?.id} /><input
          type="hidden"
          name="revision"
          value={document?.revision}
        />{/if}
      <div class="row">
        <div class="field">
          <Label for="document-kind">Type</Label><select
            id="document-kind"
            name="kind"
            bind:value={kind}
            ><option value="mission">Mission</option><option value="statutes">Statuts</option
            ><option value="annual_report">Rapport annuel</option><option value="other"
              >Autre</option
            ></select
          >
        </div>
        {#if kind === 'annual_report'}<div class="field">
            <Label for="document-year">Année</Label><Input
              id="document-year"
              name="year"
              type="number"
              bind:value={year}
              min={1900}
              max={2200}
            />
          </div>{/if}
      </div>
      <div class="field">
        <Label for="document-title">Titre</Label><Input
          id="document-title"
          name="title"
          value={title}
          oninput={(event) => updateTitle(event.currentTarget.value)}
          maxlength={180}
          required
        />
      </div>
      <div class="field">
        <Label for="document-slug">Adresse de la page</Label>
        {#if slugEditable}<Input
            id="document-slug"
            name="slug"
            value={slug}
            oninput={(event) => {
              slug = event.currentTarget.value
              slugManuallyEdited = true
            }}
            maxlength={120}
            required
          />{:else}<code>/{document?.slug}</code>
          <p>Adresse immuable depuis la première publication.</p>{/if}
      </div>
      <div class="field">
        <Label for="document-summary">Résumé</Label><textarea
          id="document-summary"
          name="summary"
          bind:value={summary}
          maxlength="500"
          rows="3"
        ></textarea>
      </div>
      <div class="field">
        <Label for="document-body">Contenu Markdown</Label><textarea
          id="document-body"
          name="bodyMarkdown"
          bind:value={body}
          maxlength="50000"
          rows="9"
        ></textarea>
      </div>
      <fieldset>
        <legend>Lieux concernés</legend>
        <div class="mode-list">
          <label
            ><input type="radio" name="targetMode" value="all" bind:group={targetMode} /> Tous les lieux
            actifs</label
          ><label
            ><input type="radio" name="targetMode" value="explicit" bind:group={targetMode} /> Lieux précis</label
          >
        </div>
        {#if targetMode === 'explicit'}<div class="site-list">
            {#each sites as site (site.id)}<label class:disabled={!site.isActive}
                ><input
                  type="checkbox"
                  name="siteIds"
                  value={site.id}
                  bind:group={selectedSiteIds}
                  disabled={!site.isActive}
                />
                {site.name}{site.isActive ? '' : ' — inactif'}</label
              >{/each}
          </div>{/if}
        {#if targetMode === 'explicit' && selectedSiteIds.length === 0}<p
            class="warning"
            role="alert"
          >
            Sélectionnez au moins un lieu actif.
          </p>{/if}
      </fieldset>
      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
      <Dialog.Footer
        ><Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button
        ><Button
          type="submit"
          disabled={submitting ||
            !title.trim() ||
            !slug.trim() ||
            (kind === 'annual_report' && !year) ||
            (targetMode === 'explicit' && !selectedSiteIds.length)}
          >{submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le brouillon'}</Button
        ></Dialog.Footer
      >
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.document-dialog) {
    max-width: 740px;
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
  .row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-4);
  }
  select,
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
  fieldset {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  legend {
    padding: 0 var(--space-2);
    font-weight: var(--weight-semibold);
  }
  .mode-list,
  .site-list {
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
    font-size: var(--text-small);
  }
  .warning {
    background: var(--warning-light);
  }
  .error {
    background: var(--danger-light);
    color: var(--danger);
  }
  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
