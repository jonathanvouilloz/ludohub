<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let name = $state('')
  let startDate = $state('')
  let endDate = $state('')
  let error = $state('')
  let submitting = $state(false)

  $effect(() => {
    if (open) {
      name = ''
      startDate = ''
      endDate = ''
      error = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Nouvelle saison</Dialog.Title>
      <Dialog.Description>
        Les samedis de la période seront générés automatiquement.
      </Dialog.Description>
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
        <Label for="season-name">Nom</Label>
        <Input id="season-name" name="name" bind:value={name} placeholder="Saison 2026" required />
      </div>

      <div class="row">
        <div class="field">
          <Label for="season-start">Début</Label>
          <Input id="season-start" name="startDate" type="date" bind:value={startDate} required />
        </div>
        <div class="field">
          <Label for="season-end">Fin</Label>
          <Input id="season-end" name="endDate" type="date" bind:value={endDate} required />
        </div>
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer la saison'}
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
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
