<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let date = $state('')
  let slotInfo = $state('')
  let notes = $state('')
  let submitting = $state(false)

  $effect(() => {
    if (open) {
      date = ''
      slotInfo = ''
      notes = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Nouvelle demande d'aide</Dialog.Title>
      <Dialog.Description>
        Publiez une demande de remplacement visible par toutes les ludothèques du réseau.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/create"
      use:enhance={toastEnhance({
        success: 'Demande publiée.',
        onPending: (p) => (submitting = p),
        onSuccess: () => (open = false),
      })}
    >
      <div class="field">
        <Label for="help-date">Date</Label>
        <DatePicker id="help-date" name="date" bind:value={date} />
      </div>

      <div class="field">
        <Label for="help-slot">Créneau (facultatif)</Label>
        <Input
          id="help-slot"
          name="slotInfo"
          bind:value={slotInfo}
          placeholder="Ex : samedi 14h–17h"
        />
      </div>

      <div class="field">
        <Label for="help-notes">Note (facultatif)</Label>
        <textarea
          id="help-notes"
          name="notes"
          bind:value={notes}
          rows="3"
          placeholder="Précisez le besoin…"
        ></textarea>
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting || !date}>
          {submitting ? 'Publication…' : 'Publier la demande'}
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
</style>
