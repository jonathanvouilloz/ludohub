<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  const typeLabels: Record<string, string> = {
    conge: 'Congé',
    vacances: 'Vacances',
    formation: 'Formation',
    indisponible: 'Indisponible',
  }

  let type = $state<string>('conge')
  let startDate = $state('')
  let endDate = $state('')
  let notes = $state('')
  let error = $state('')
  let submitting = $state(false)

  // Réinitialise les champs à chaque ouverture.
  $effect(() => {
    if (open) {
      type = 'conge'
      startDate = ''
      endDate = ''
      notes = ''
      error = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Nouvelle demande d'absence</Dialog.Title>
      <Dialog.Description>
        Indiquez le type et la période. Un·e responsable validera votre demande.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/request"
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
      <div class="field">
        <Label for="absence-type">Type</Label>
        <Select.Root type="single" name="type" bind:value={type}>
          <Select.Trigger id="absence-type">{typeLabels[type]}</Select.Trigger>
          <Select.Content>
            <Select.Item value="conge" label="Congé" />
            <Select.Item value="vacances" label="Vacances" />
            <Select.Item value="formation" label="Formation" />
            <Select.Item value="indisponible" label="Indisponible" />
          </Select.Content>
        </Select.Root>
      </div>

      <div class="row">
        <div class="field">
          <Label for="absence-start">Du</Label>
          <DatePicker id="absence-start" name="startDate" bind:value={startDate} />
        </div>
        <div class="field">
          <Label for="absence-end">Au</Label>
          <DatePicker id="absence-end" name="endDate" bind:value={endDate} />
        </div>
      </div>

      <div class="field">
        <Label for="absence-notes">Note (facultatif)</Label>
        <textarea
          id="absence-notes"
          name="notes"
          bind:value={notes}
          rows="3"
          placeholder="Précisez si besoin…"
        ></textarea>
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Envoi…' : 'Envoyer la demande'}
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
  .row {
    display: flex;
    gap: var(--space-4);
  }
  .row .field {
    flex: 1;
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
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
