<script lang="ts" module>
  export type NewsSite = { id: string; name: string; isActive: boolean }
  export type EditableNews = {
    id: string
    revision: number
    slug: string
    title: string
    summary: string
    body: string
    imageUrl: string | null
    imageAlt: string | null
    publishedAt: Date | null
    targets: Array<{ siteId: string; site: NewsSite }>
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let {
    open = $bindable(false),
    news = null,
    sites,
  }: { open?: boolean; news?: EditableNews | null; sites: NewsSite[] } = $props()

  const isEdit = $derived(news !== null)
  const slugEditable = $derived(!news?.publishedAt)
  let title = $state('')
  let slug = $state('')
  let summary = $state('')
  let body = $state('')
  let slugManuallyEdited = $state(false)
  let targetMode = $state<'all' | 'explicit'>('all')
  let selectedSiteIds = $state<string[]>([])
  let submitting = $state(false)
  let submitError = $state('')

  $effect(() => {
    if (open) {
      title = news?.title ?? ''
      slug = news?.slug ?? ''
      slugManuallyEdited = news !== null
      summary = news?.summary ?? ''
      body = news?.body ?? ''
      targetMode = news && news.targets.length > 0 ? 'explicit' : 'all'
      selectedSiteIds =
        news?.targets.filter((target) => target.site.isActive).map((target) => target.siteId) ?? []
      submitError = ''
    }
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
    if (slugEditable && !slugManuallyEdited) slug = slugify(value)
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="news-dialog">
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier l’actualité' : 'Nouvelle actualité'}</Dialog.Title>
      <Dialog.Description>
        Préparez le contenu en brouillon, puis publiez-le depuis la liste.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Actualité mise à jour.' : 'Brouillon créé.',
        errorMode: 'inline',
        onPending: (pending) => {
          submitting = pending
          if (pending) submitError = ''
        },
        onError: (message) => (submitError = message),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}
        <input type="hidden" name="id" value={news?.id} />
        <input type="hidden" name="revision" value={news?.revision} />
      {/if}

      <div class="field">
        <Label for="news-title">Titre</Label>
        <Input
          id="news-title"
          name="title"
          value={title}
          oninput={(event) => updateTitle(event.currentTarget.value)}
          maxlength={180}
          required
        />
      </div>

      <div class="field">
        <Label for="news-slug">Adresse de la page</Label>
        {#if slugEditable}
          <Input
            id="news-slug"
            name="slug"
            value={slug}
            oninput={(event) => {
              slug = event.currentTarget.value
              slugManuallyEdited = true
            }}
            maxlength={120}
            placeholder="Générée depuis le titre si laissée vide"
          />
          <p class="hint">Modifiable jusqu’à la première publication.</p>
        {:else}
          <code>/{news?.slug}</code>
          <p class="hint">Cette adresse est définitive depuis la première publication.</p>
        {/if}
      </div>

      <div class="field">
        <Label for="news-summary">Résumé</Label>
        <textarea
          id="news-summary"
          name="summary"
          bind:value={summary}
          maxlength="500"
          rows="3"
          required
        ></textarea>
      </div>

      <div class="field">
        <Label for="news-body">Contenu Markdown</Label>
        <textarea
          id="news-body"
          name="body"
          bind:value={body}
          maxlength="50000"
          rows="10"
          placeholder="Utilisez les titres, listes et liens Markdown."
          required
        ></textarea>
      </div>

      <fieldset>
        <legend>Lieux concernés</legend>
        <div class="mode-list">
          <label class="mode-option">
            <input type="radio" name="targetMode" value="all" bind:group={targetMode} />
            <span><strong>Tous les lieux actifs</strong><small>Ciblage dynamique.</small></span>
          </label>
          <label class="mode-option">
            <input type="radio" name="targetMode" value="explicit" bind:group={targetMode} />
            <span><strong>Lieux précis</strong><small>Au moins un lieu actif.</small></span>
          </label>
        </div>

        {#if targetMode === 'explicit'}
          <div class="site-list">
            {#each sites as site (site.id)}
              <label class="site-option" class:disabled={!site.isActive}>
                <input
                  type="checkbox"
                  name="siteIds"
                  value={site.id}
                  bind:group={selectedSiteIds}
                  disabled={!site.isActive}
                />
                <span>{site.name}{site.isActive ? '' : ' — inactif'}</span>
              </label>
            {/each}
          </div>
          {#if selectedSiteIds.length === 0}
            <p class="warning" role="alert">Sélectionnez au moins un lieu actif.</p>
          {/if}
        {/if}
      </fieldset>

      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button
          type="submit"
          disabled={submitting ||
            !title.trim() ||
            !slug.trim() ||
            !summary.trim() ||
            !body.trim() ||
            (targetMode === 'explicit' && selectedSiteIds.length === 0)}
        >
          {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le brouillon'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.news-dialog) {
    max-width: 720px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .field,
  fieldset {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0 0 var(--space-4);
  }
  fieldset {
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-1);
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-input, var(--bg-card));
    color: var(--text-main);
    font: inherit;
    resize: vertical;
  }
  code {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--bg-muted);
    color: var(--text-main);
  }
  .hint,
  .warning {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .warning {
    color: var(--warning);
  }
  .mode-list {
    display: grid;
    gap: var(--space-2);
  }
  .mode-option,
  .site-option {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .mode-option span {
    display: grid;
    gap: var(--space-1);
  }
  .mode-option small {
    color: var(--text-muted);
  }
  .site-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .site-option {
    align-items: center;
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
  }
  .mode-option:focus-within,
  .site-option:focus-within {
    box-shadow: var(--shadow-focus);
  }
  .site-option.disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .error {
    margin: 0 0 var(--space-4);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
</style>
