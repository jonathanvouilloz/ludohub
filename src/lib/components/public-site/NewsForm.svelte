<script lang="ts" module>
  export type NewsFormSite = { id: string; name: string; isActive: boolean }
  export type NewsFormValue = {
    id: string
    revision: number
    slug: string
    title: string
    summary: string
    body: string
    publishedAt: Date | null
    targets: Array<{ siteId: string; site: NewsFormSite }>
  }
</script>

<script lang="ts">
  import { goto } from '$app/navigation'
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'

  let {
    news = null,
    sites,
    action,
    cancelHref,
    successHref,
  }: {
    news?: NewsFormValue | null
    sites: NewsFormSite[]
    action: string
    cancelHref: string
    successHref: string
  } = $props()
  const isEdit = $derived(news !== null)
  const slugEditable = $derived(!news?.publishedAt)
  let title = $state('')
  let slug = $state('')
  let summary = $state('')
  let body = $state('')
  let slugManuallyEdited = $state(false)
  let targetMode = $state<'all' | 'explicit'>('all')
  let selectedSiteIds = $state<string[]>([])
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
    slugManuallyEdited = news !== null
    targetMode = news && news.targets.length > 0 ? 'explicit' : 'all'
    selectedSiteIds =
      news?.targets.filter((target) => target.site.isActive).map((target) => target.siteId) ?? []
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
    if (slugEditable && !slugManuallyEdited) slug = slugify(value)
  }
</script>

<form
  method="POST"
  {action}
  use:enhance={toastEnhance({
    success: isEdit ? 'Actualité mise à jour.' : 'Brouillon créé.',
    errorMode: 'inline',
    skipUpdate: true,
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
      <Label for="news-body">Texte de l’actualité</Label><textarea
        id="news-body"
        name="body"
        bind:value={body}
        maxlength="50000"
        rows="14"
        placeholder="Rédigez le contenu complet de l’actualité."
        required
      ></textarea>
      <p class="hint">Vous pouvez utiliser des titres, des listes et des liens.</p>
    </div>
  </section>

  <section aria-labelledby="visibility-title">
    <div class="section-heading">
      <h2 id="visibility-title">Lieux concernés</h2>
      <p>Choisissez où cette actualité sera visible.</p>
    </div>
    <div class="choice-list">
      <label class="choice"
        ><input type="radio" name="targetMode" value="all" bind:group={targetMode} /><span
          ><strong>Tous les lieux actifs</strong><small
            >Les nouveaux lieux seront automatiquement inclus.</small
          ></span
        ></label
      >
      <label class="choice"
        ><input type="radio" name="targetMode" value="explicit" bind:group={targetMode} /><span
          ><strong>Seulement certains lieux</strong><small
            >Choisissez au moins un lieu ci-dessous.</small
          ></span
        ></label
      >
    </div>
    {#if targetMode === 'explicit'}
      <div class="site-list">
        {#each sites as site (site.id)}<label class="site" class:disabled={!site.isActive}
            ><input
              type="checkbox"
              name="siteIds"
              value={site.id}
              bind:group={selectedSiteIds}
              disabled={!site.isActive}
            /><span>{site.name}{site.isActive ? '' : ' — inactif'}</span></label
          >{/each}
      </div>
      {#if selectedSiteIds.length === 0}<p class="warning" role="alert">
          Choisissez au moins un lieu actif.
        </p>{/if}
    {/if}
  </section>

  <details class="advanced">
    <summary>Options avancées</summary>
    <div class="field">
      <Label for="news-slug">Adresse de la page</Label>{#if slugEditable}<Input
          id="news-slug"
          name="slug"
          value={slug}
          oninput={(event) => {
            slug = event.currentTarget.value
            slugManuallyEdited = true
          }}
          maxlength={120}
        />
        <p class="hint">
          Générée automatiquement depuis le titre. À modifier uniquement si nécessaire.
        </p>{:else}<code>/{news?.slug}</code>
        <p class="hint">Cette adresse est définitive depuis la première publication.</p>{/if}
    </div>
  </details>

  {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
  <footer>
    <Button href={cancelHref} variant="outline">Annuler et revenir</Button><Button
      type="submit"
      disabled={submitting ||
        !title.trim() ||
        !slug.trim() ||
        !summary.trim() ||
        !body.trim() ||
        (targetMode === 'explicit' && selectedSiteIds.length === 0)}
      >{submitting
        ? 'Enregistrement…'
        : isEdit
          ? 'Enregistrer les modifications'
          : 'Créer le brouillon'}</Button
    >
  </footer>
</form>

<style>
  form {
    display: grid;
    gap: var(--space-5);
  }
  section,
  .advanced {
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
  .choice-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .choice,
  .site {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-height: 44px;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .choice:focus-within,
  .site:focus-within {
    box-shadow: var(--shadow-focus);
  }
  .choice span {
    display: grid;
    gap: var(--space-1);
  }
  .choice small {
    color: var(--text-muted);
  }
  .site-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .site {
    align-items: center;
  }
  .site.disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .advanced summary {
    min-height: 44px;
    color: var(--primary);
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }
  .advanced[open] summary {
    margin-bottom: var(--space-3);
  }
  code {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--bg-muted);
  }
  .warning {
    color: var(--warning);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
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
    section,
    .advanced {
      padding: var(--space-4);
    }
    .choice-list {
      grid-template-columns: 1fr;
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
