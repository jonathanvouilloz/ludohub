<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let { data, form } = $props()

  let submitting = $state(false)
  let items = $state<Array<{ name: string; quantity: string }>>([{ name: '', quantity: '1' }])

  function addRow() {
    items.push({ name: '', quantity: '1' })
  }
  function removeRow(index: number) {
    items.splice(index, 1)
  }
</script>

<svelte:head>
  <title>Nouveau thème — {data.ludo.name}</title>
</svelte:head>

<main class="new-theme">
  <header>
    <a class="back" href="/{data.ludo.slug}/themes">← Thèmes</a>
    <h1>Nouveau thème</h1>
  </header>

  {#if form?.error}
    <p class="banner" role="alert">{form.error}</p>
  {/if}

  <form
    method="POST"
    action="?/create"
    use:enhance={() => {
      submitting = true
      return async ({ update }) => {
        submitting = false
        await update()
      }
    }}
  >
    <div class="field">
      <Label for="name">Nom du thème</Label>
      <Input id="name" name="name" placeholder="Ex. Carnaval, Pirates…" required />
    </div>

    <div class="field">
      <Label for="description">Description (facultatif)</Label>
      <textarea id="description" name="description" rows="3" placeholder="Contenu, usage…"
      ></textarea>
    </div>

    <fieldset class="items">
      <legend>Items</legend>
      {#each items as item, i (i)}
        <div class="item-row">
          <Input name="itemName" bind:value={item.name} placeholder="Nom de l'item" />
          <Input name="itemQuantity" type="number" min="1" bind:value={item.quantity} />
          <Button type="button" variant="ghost" size="sm" onclick={() => removeRow(i)}>×</Button>
        </div>
      {/each}
      <Button type="button" variant="outline" size="sm" onclick={addRow}>+ Ajouter un item</Button>
    </fieldset>

    <label class="checkbox">
      <input type="checkbox" name="isShareable" checked />
      <span>Partager ce thème dans le catalogue réseau</span>
    </label>

    <div class="actions">
      <Button href="/{data.ludo.slug}/themes" variant="outline">Annuler</Button>
      <Button type="submit" disabled={submitting}
        >{submitting ? 'Création…' : 'Créer le thème'}</Button
      >
    </div>
  </form>
</main>

<style>
  .new-theme {
    max-width: 40rem;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
  }
  h1 {
    color: var(--text-main);
    margin: var(--space-2) 0 var(--space-6);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
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
  .items {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  legend {
    color: var(--text-main);
    font-weight: var(--weight-medium);
    padding: 0 var(--space-2);
  }
  .item-row {
    display: grid;
    grid-template-columns: 1fr 6rem auto;
    gap: var(--space-2);
    align-items: center;
  }
  .checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-main);
  }
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
