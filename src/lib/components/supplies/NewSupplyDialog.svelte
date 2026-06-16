<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  const categoryLabels: Record<string, string> = {
    jeux: 'Jeux',
    materiel: 'Matériel',
    fournitures: 'Fournitures',
    autre: 'Autre',
  }
  const urgencyLabels: Record<string, string> = {
    normale: 'Normale',
    haute: 'Haute',
    critique: 'Critique',
  }

  let name = $state('')
  let category = $state<string>('materiel')
  let urgency = $state<string>('normale')
  let notes = $state('')
  let error = $state('')
  let submitting = $state(false)

  // Réinitialise les champs à chaque ouverture.
  $effect(() => {
    if (open) {
      name = ''
      category = 'materiel'
      urgency = 'normale'
      notes = ''
      error = ''
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
        <Label for="supply-name">Nom</Label>
        <Input
          id="supply-name"
          name="name"
          bind:value={name}
          placeholder="Ce qu'il faut"
          required
        />
      </div>

      <div class="row">
        <div class="field">
          <Label for="supply-category">Catégorie</Label>
          <Select.Root type="single" name="category" bind:value={category}>
            <Select.Trigger id="supply-category">{categoryLabels[category]}</Select.Trigger>
            <Select.Content>
              <Select.Item value="jeux" label="Jeux" />
              <Select.Item value="materiel" label="Matériel" />
              <Select.Item value="fournitures" label="Fournitures" />
              <Select.Item value="autre" label="Autre" />
            </Select.Content>
          </Select.Root>
        </div>

        <div class="field">
          <Label for="supply-urgency">Urgence</Label>
          <Select.Root type="single" name="urgency" bind:value={urgency}>
            <Select.Trigger id="supply-urgency">{urgencyLabels[urgency]}</Select.Trigger>
            <Select.Content>
              <Select.Item value="normale" label="Normale" />
              <Select.Item value="haute" label="Haute" />
              <Select.Item value="critique" label="Critique" />
            </Select.Content>
          </Select.Root>
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

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

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
  .row {
    display: flex;
    gap: var(--space-3);
  }
  .row .field {
    flex: 1;
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
  .error {
    margin: 0 0 var(--space-4);
    color: var(--danger);
    font-size: var(--text-small);
  }
</style>
