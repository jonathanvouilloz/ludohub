<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let title = $state('')
  let link = $state('')
  let priceChf = $state('')
  let error = $state('')
  let submitting = $state(false)

  // Réinitialise les champs à chaque ouverture.
  $effect(() => {
    if (open) {
      title = ''
      link = ''
      priceChf = ''
      error = ''
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Nouveau souhait</Dialog.Title>
      <Dialog.Description>Un jeu à acheter pour la ludothèque.</Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/add"
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
        <Label for="wish-title">Titre</Label>
        <Input id="wish-title" name="title" bind:value={title} placeholder="Nom du jeu" required />
      </div>

      <div class="field">
        <Label for="wish-link">Lien (facultatif)</Label>
        <Input id="wish-link" name="link" type="url" bind:value={link} placeholder="https://…" />
      </div>

      <div class="field">
        <Label for="wish-price">Prix CHF (facultatif)</Label>
        <Input
          id="wish-price"
          name="priceChf"
          inputmode="decimal"
          bind:value={priceChf}
          placeholder="49.90"
        />
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Ajout…' : 'Ajouter'}
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
  .error {
    margin: 0 0 var(--space-4);
    color: var(--danger);
    font-size: var(--text-small);
  }
</style>
