<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  type LudoOption = { id: string; name: string }

  let {
    open = $bindable(false),
    themeId,
    ludos,
  }: { open?: boolean; themeId: string; ludos: LudoOption[] } = $props()

  let toLudoId = $state('')
  let notes = $state('')
  let error = $state('')
  let submitting = $state(false)

  const selectedName = $derived(
    ludos.find((l) => l.id === toLudoId)?.name ?? 'Choisir une ludothèque',
  )

  $effect(() => {
    if (open) {
      toLudoId = ''
      notes = ''
      error = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Prêter ce thème</Dialog.Title>
      <Dialog.Description>
        Sélectionnez la ludothèque à qui prêter ce thème. Un prêt actif empêche un nouveau prêt
        jusqu’au retour.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/loan"
      use:enhance={() => {
        submitting = true
        return async ({ result, update }) => {
          submitting = false
          if (result.type === 'failure') {
            error = String(result.data?.error ?? 'Une erreur est survenue.')
            await update({ reset: false })
            return
          }
          await update()
          open = false
        }
      }}
    >
      <input type="hidden" name="themeId" value={themeId} />
      <input type="hidden" name="toLudoId" value={toLudoId} />

      <div class="field">
        <Label for="loan-ludo">Ludothèque destinataire</Label>
        <Select.Root type="single" bind:value={toLudoId}>
          <Select.Trigger id="loan-ludo">{selectedName}</Select.Trigger>
          <Select.Content>
            {#each ludos as ludo (ludo.id)}
              <Select.Item value={ludo.id} label={ludo.name} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <div class="field">
        <Label for="loan-notes">Note (facultatif)</Label>
        <textarea
          id="loan-notes"
          name="notes"
          bind:value={notes}
          rows="3"
          placeholder="Durée prévue, état du matériel…"
        ></textarea>
      </div>

      {#if error}<p class="error" role="alert">{error}</p>{/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting || !toLudoId}>
          {submitting ? 'Enregistrement…' : 'Prêter'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  textarea {
    font: inherit;
    color: var(--text-main);
    background: var(--bg-input, var(--bg-card));
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    resize: vertical;
  }
  textarea:focus-visible {
    outline: 2px solid var(--ring, var(--ludo-color));
    outline-offset: 1px;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: var(--text-small);
  }
</style>
