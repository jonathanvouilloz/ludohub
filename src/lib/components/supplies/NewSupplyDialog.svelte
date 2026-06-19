<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  const urgencies = [
    { value: 'normale', label: 'Normale' },
    { value: 'haute', label: 'Haute' },
    { value: 'critique', label: 'Critique' },
  ] as const

  let name = $state('')
  let link = $state('')
  let urgency = $state<string>('normale')
  let notes = $state('')
  let submitting = $state(false)

  // Réinitialise les champs à chaque ouverture.
  $effect(() => {
    if (open) {
      name = ''
      link = ''
      urgency = 'normale'
      notes = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Nouvelle demande</Dialog.Title>
      <Dialog.Description>Matériel ou fourniture à commander pour la ludothèque.</Dialog.Description
      >
    </Dialog.Header>

    <form
      method="POST"
      action="?/create"
      use:enhance={toastEnhance({
        success: 'Demande créée.',
        onPending: (p) => (submitting = p),
        onSuccess: () => (open = false),
      })}
    >
      <div class="field">
        <Label for="supply-name">Nom</Label>
        <Input
          id="supply-name"
          name="name"
          bind:value={name}
          placeholder="Ce qu'il faut"
          required
        />
      </div>

      <div class="field">
        <Label for="supply-link">Lien (facultatif)</Label>
        <Input id="supply-link" name="link" type="url" bind:value={link} placeholder="https://…" />
      </div>

      <div class="field">
        <span class="field-label">Urgence</span>
        <div class="pills" role="radiogroup" aria-label="Urgence">
          {#each urgencies as u (u.value)}
            <label class="pill urgency-{u.value}" class:selected={urgency === u.value}>
              <input
                type="radio"
                name="urgency"
                value={u.value}
                bind:group={urgency}
                class="sr-only"
              />
              {u.label}
            </label>
          {/each}
        </div>
      </div>

      <div class="field">
        <Label for="supply-notes">Note (facultatif)</Label>
        <textarea
          id="supply-notes"
          name="notes"
          bind:value={notes}
          rows="3"
          placeholder="Précisez si besoin…"
        ></textarea>
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Envoi…' : 'Créer la demande'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .field-label {
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  .pills {
    display: flex;
    gap: var(--space-2);
  }
  .pill {
    flex: 1;
    text-align: center;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-card);
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out-strong),
      color var(--dur-fast) var(--ease-out-strong),
      border-color var(--dur-fast) var(--ease-out-strong);
  }
  .pill:hover {
    background: var(--bg-hover);
  }
  /* Sélection color-codée par sévérité. */
  .pill.selected {
    color: var(--text-inverse);
  }
  .pill.urgency-normale.selected {
    background: var(--text-subtle);
    border-color: var(--text-subtle);
  }
  .pill.urgency-haute.selected {
    background: var(--warning);
    border-color: var(--warning);
  }
  .pill.urgency-critique.selected {
    background: var(--danger);
    border-color: var(--danger);
  }
  /* Anneau de focus clavier sur la pastille active. */
  .pill:focus-within {
    box-shadow: var(--shadow-focus);
  }
  textarea {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-input, var(--bg-card));
    color: var(--text-main);
    font-family: inherit;
    font-size: var(--text-body);
    resize: vertical;
  }
</style>
