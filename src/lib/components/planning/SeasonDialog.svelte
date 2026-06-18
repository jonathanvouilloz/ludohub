<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let name = $state('')
  let startDate = $state('')
  let endDate = $state('')
  let activateNow = $state(false)
  let error = $state('')
  let submitting = $state(false)

  $effect(() => {
    if (open) {
      name = ''
      startDate = ''
      endDate = ''
      activateNow = false
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
        <Input id="season-name" name="name" bind:value={name} placeholder="Saison 2026-27" required />
      </div>

      <div class="row">
        <div class="field">
          <Label>Début</Label>
          <DatePicker bind:value={startDate} name="startDate" placeholder="Date de début" />
        </div>
        <div class="field">
          <Label>Fin</Label>
          <DatePicker bind:value={endDate} name="endDate" placeholder="Date de fin" />
        </div>
      </div>

      <label class="activate-check">
        <input
          type="checkbox"
          bind:checked={activateNow}
          name="activateNow"
          value="true"
        />
        <span>
          Activer immédiatement
          <span class="activate-note">— la saison actuellement active sera archivée</span>
        </span>
      </label>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting || !startDate || !endDate}>
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
  .activate-check {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--text-small);
    color: var(--text-main);
  }
  .activate-check input[type='checkbox'] {
    margin-top: 2px;
    flex-shrink: 0;
  }
  .activate-note {
    color: var(--text-muted);
  }
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
