<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Checkbox } from '$lib/components/ui/checkbox/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  type Item = { id: string; name: string; quantity: number; isArchived: boolean }

  let { open = $bindable(false), items = [] }: { open?: boolean; items?: Item[] } = $props()

  // Seuls les items non archivés peuvent être sortis de la caisse.
  const available = $derived(items.filter((i) => !i.isArchived))

  let selected = $state<string[]>([])
  let notes = $state('')
  let error = $state('')
  let submitting = $state(false)

  // Réinitialise à chaque ouverture (tout coché par défaut : on sort souvent ~80 %).
  $effect(() => {
    if (open) {
      selected = available.map((i) => i.id)
      notes = ''
      error = ''
    }
  })

  function toggle(id: string, checked: boolean) {
    selected = checked ? [...selected, id] : selected.filter((x) => x !== id)
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Installer le thème</Dialog.Title>
      <Dialog.Description>
        Cochez les items sortis de la caisse pour l'animation. Le reste y demeure.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action="?/installTheme"
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
      <fieldset class="items">
        <legend class="sr-only">Items du thème</legend>
        {#if available.length === 0}
          <p class="muted">Ce thème n'a aucun item à installer.</p>
        {/if}
        {#each available as item (item.id)}
          <div class="item">
            <Checkbox
              id={`install-${item.id}`}
              checked={selected.includes(item.id)}
              onCheckedChange={(v) => toggle(item.id, v === true)}
            />
            <Label for={`install-${item.id}`}>{item.name}</Label>
            <span class="qty">×{item.quantity}</span>
            {#if selected.includes(item.id)}
              <input type="hidden" name="itemIds" value={item.id} />
            {/if}
          </div>
        {/each}
      </fieldset>

      <div class="field">
        <Label for="install-notes">Note (facultatif)</Label>
        <textarea
          id="install-notes"
          name="notes"
          bind:value={notes}
          rows="2"
          placeholder="État, observations…"
        ></textarea>
      </div>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting || selected.length === 0}>
          {submitting ? 'Installation…' : `Installer (${selected.length})`}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  .items {
    border: none;
    margin: 0 0 var(--space-4);
    padding: 0;
    max-height: 18rem;
    overflow-y: auto;
  }
  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }
  .item:last-child {
    border-bottom: none;
  }
  .qty {
    margin-left: auto;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
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
  .muted {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
</style>
