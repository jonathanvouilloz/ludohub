<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  type ThemeItem = { id: string; name: string; quantity: number }

  let { items, editable }: { items: ThemeItem[]; editable: boolean } = $props()

  let name = $state('')
  let adding = $state(false)
</script>

<div class="items">
  {#if items.length === 0}
    <p class="empty">Aucun item pour le moment.</p>
  {:else}
    <ul>
      {#each items as item (item.id)}
        <li>
          <span class="name">{item.name}</span>
          <span class="qty">×{item.quantity}</span>
          {#if editable}
            <form method="POST" action="?/removeItem" use:enhance>
              <input type="hidden" name="itemId" value={item.id} />
              <Button type="submit" variant="ghost" size="sm">Retirer</Button>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if editable}
    <form
      class="add"
      method="POST"
      action="?/addItem"
      use:enhance={() => {
        adding = true
        return async ({ update }) => {
          adding = false
          name = ''
          await update()
        }
      }}
    >
      <div class="field grow">
        <Label for="item-name">Nouvel item</Label>
        <Input id="item-name" name="name" bind:value={name} placeholder="Nom de l'item" required />
      </div>
      <Button type="submit" disabled={adding || !name.trim()}>Ajouter</Button>
    </form>
  {/if}
</div>

<style>
  .items {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
  }
  .name {
    color: var(--text-main);
  }
  .qty {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  li form {
    margin-left: auto;
  }
  .empty {
    color: var(--text-subtle);
    font-style: italic;
    margin: 0;
  }
  .add {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .field.grow {
    flex: 1;
  }
</style>
