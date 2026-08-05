<script lang="ts" module>
  export type FaqSite = { id: string; name: string; isActive: boolean }
  export type EditableFaq = {
    id: string
    revision: number
    question: string
    answerMarkdown: string
    category: string | null
    sortOrder: number
    status: 'draft' | 'published' | 'hidden'
    publishedAt: Date | null
    targets: Array<{ siteId: string; site: FaqSite }>
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
    faq = null,
    sites,
  }: { open?: boolean; faq?: EditableFaq | null; sites: FaqSite[] } = $props()
  let question = $state('')
  let answer = $state('')
  let category = $state('')
  let sortOrder = $state(0)
  let targetMode = $state<'all' | 'explicit'>('all')
  let selectedSiteIds = $state<string[]>([])
  let submitting = $state(false)
  let submitError = $state('')
  const isEdit = $derived(faq !== null)

  $effect(() => {
    if (!open) return
    question = faq?.question ?? ''
    answer = faq?.answerMarkdown ?? ''
    category = faq?.category ?? ''
    sortOrder = faq?.sortOrder ?? 0
    targetMode = faq && faq.targets.length > 0 ? 'explicit' : 'all'
    selectedSiteIds =
      faq?.targets.filter((target) => target.site.isActive).map((target) => target.siteId) ?? []
    submitError = ''
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="faq-dialog">
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier la question' : 'Nouvelle question'}</Dialog.Title>
      <Dialog.Description
        >Rédigez une réponse en Markdown et organisez son affichage.</Dialog.Description
      >
    </Dialog.Header>
    <form
      method="POST"
      action={isEdit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Question mise à jour.' : 'Brouillon créé.',
        errorMode: 'inline',
        onPending: (value) => {
          submitting = value
          if (value) submitError = ''
        },
        onError: (message) => (submitError = message),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit}<input type="hidden" name="id" value={faq?.id} /><input
          type="hidden"
          name="revision"
          value={faq?.revision}
        />{/if}
      <div class="field">
        <Label for="faq-question">Question</Label><Input
          id="faq-question"
          name="question"
          bind:value={question}
          maxlength={300}
          required
        />
      </div>
      <div class="field">
        <Label for="faq-answer">Réponse Markdown</Label><textarea
          id="faq-answer"
          name="answerMarkdown"
          bind:value={answer}
          maxlength="20000"
          rows="9"
          required
        ></textarea>
      </div>
      <div class="row">
        <div class="field">
          <Label for="faq-category">Catégorie</Label><Input
            id="faq-category"
            name="category"
            bind:value={category}
            maxlength={100}
          />
        </div>
        <div class="field">
          <Label for="faq-order">Ordre</Label><Input
            id="faq-order"
            name="sortOrder"
            type="number"
            bind:value={sortOrder}
            min={0}
            step={1}
            required
          />
        </div>
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
            !question.trim() ||
            !answer.trim() ||
            (targetMode === 'explicit' && !selectedSiteIds.length)}
          >{submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le brouillon'}</Button
        ></Dialog.Footer
      >
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.faq-dialog) {
    max-width: 720px;
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
  fieldset {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  legend {
    padding: 0 var(--space-2);
    font-weight: var(--weight-semibold);
  }
  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    resize: vertical;
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
