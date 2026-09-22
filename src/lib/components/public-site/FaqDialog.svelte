<script lang="ts" module>
  export type FaqCategory = { id: string; name: string; isActive: boolean }
  export type EditableFaq = {
    id: string
    revision: number
    question: string
    answerText: string
    categoryId: string
    status: 'draft' | 'published' | 'hidden'
    publishedAt: Date | null
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
    categories,
  }: { open?: boolean; faq?: EditableFaq | null; categories: FaqCategory[] } = $props()
  let question = $state('')
  let answer = $state('')
  let categoryId = $state('')
  let submitting = $state(false)
  let submitError = $state('')
  const isEdit = $derived(faq !== null)

  $effect(() => {
    if (!open) return
    question = faq?.question ?? ''
    answer = faq?.answerText ?? ''
    categoryId = faq?.categoryId ?? categories.find((category) => category.isActive)?.id ?? ''
    submitError = ''
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="faq-dialog">
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Modifier la question' : 'Nouvelle question'}</Dialog.Title>
      <Dialog.Description>Rédigez une réponse simple et choisissez sa catégorie.</Dialog.Description
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
        <Label for="faq-answer">Réponse</Label><textarea
          id="faq-answer"
          name="answerText"
          bind:value={answer}
          maxlength="20000"
          rows="9"
          required
        ></textarea>
      </div>
      <div class="field">
        <Label for="faq-category">Catégorie</Label><select
          id="faq-category"
          name="categoryId"
          bind:value={categoryId}
          required
        >
          {#each categories.filter((category) => category.isActive) as category (category.id)}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
      </div>
      {#if submitError}<p class="error" role="alert">{submitError}</p>{/if}
      <Dialog.Footer
        ><Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button
        ><Button
          type="submit"
          disabled={submitting || !question.trim() || !answer.trim() || !categoryId}
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
  .field {
    display: grid;
    gap: var(--space-3);
  }
  form {
    gap: var(--space-5);
  }
  textarea,
  select {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    resize: vertical;
  }
  .field :global(label) {
    display: block;
  }
  .error {
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .error {
    background: var(--danger-light);
    color: var(--danger);
  }
</style>
