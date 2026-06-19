<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import PackageOpenIcon from '@lucide/svelte/icons/package-open'

  type ThemeItem = {
    id: string
    name: string
    quantity: number
    condition?: 'present' | 'a_reparer' | 'manquant'
  }

  let { items, editable }: { items: ThemeItem[]; editable: boolean } = $props()

  let name = $state('')
  let adding = $state(false)
  let dialogName = $state('')
  let dialogAdding = $state(false)
  let dialogOpen = $state(false)

  $effect(() => {
    if (dialogOpen) dialogName = ''
  })
</script>

<div class="items-block">
  <div class="head">
    <h2>Éléments du thème</h2>
    {#if editable}
      <Button
        variant="ghost"
        size="icon-sm"
        title="Ajouter un élément"
        onclick={() => (dialogOpen = true)}
      >
        <PlusIcon aria-hidden="true" />
        <span class="sr-only">Ajouter un élément</span>
      </Button>
    {/if}
  </div>

  <div class="items">
    {#if items.length === 0}
      <EmptyState icon={PackageOpenIcon} title="Aucun élément pour le moment." compact />
    {:else}
      <ul>
        {#each items as item (item.id)}
          <li>
            <span class="name">{item.name}</span>
            <span class="qty">×{item.quantity}</span>
            {#if item.condition === 'a_reparer'}
              <Badge variant="warning">À réparer</Badge>
            {:else if item.condition === 'manquant'}
              <Badge variant="destructive">Manquant</Badge>
            {/if}
            {#if editable}
              <AlertDialog.Root>
                <AlertDialog.Trigger
                  class="{buttonVariants({ variant: 'ghost', size: 'icon-sm' })} ml-auto"
                  title="Retirer"
                >
                  <Trash2Icon class="danger-icon" aria-hidden="true" />
                  <span class="sr-only">Retirer</span>
                </AlertDialog.Trigger>
                <AlertDialog.Content>
                  <AlertDialog.Header>
                    <AlertDialog.Title>Retirer « {item.name} » ?</AlertDialog.Title>
                    <AlertDialog.Description>
                      L'élément sera retiré de ce thème. Action définitive.
                    </AlertDialog.Description>
                  </AlertDialog.Header>
                  <form
                    method="POST"
                    action="?/removeItem"
                    use:enhance={toastEnhance({ success: 'Objet retiré.' })}
                  >
                    <input type="hidden" name="itemId" value={item.id} />
                    <AlertDialog.Footer>
                      <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
                      <button type="submit" class={buttonVariants({ variant: 'destructive' })}>
                        Retirer
                      </button>
                    </AlertDialog.Footer>
                  </form>
                </AlertDialog.Content>
              </AlertDialog.Root>
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
        use:enhance={toastEnhance({
          success: 'Objet ajouté.',
          onPending: (p) => (adding = p),
          onSuccess: () => (name = ''),
        })}
      >
        <div class="field grow">
          <Label for="item-name">Nouvel élément</Label>
          <Input
            id="item-name"
            name="name"
            bind:value={name}
            placeholder="Nom de l'élément"
            required
          />
        </div>
        <Button type="submit" disabled={adding || !name.trim()}>Ajouter</Button>
      </form>
    {/if}
  </div>
</div>

{#if editable}
  <Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Ajouter un élément</Dialog.Title>
        <Dialog.Description>Ajoute un nouvel élément à ce thème.</Dialog.Description>
      </Dialog.Header>
      <form
        method="POST"
        action="?/addItem"
        use:enhance={toastEnhance({
          success: 'Objet ajouté.',
          onPending: (p) => (dialogAdding = p),
          onSuccess: () => {
            dialogName = ''
            dialogOpen = false
          },
        })}
      >
        <div class="field">
          <Label for="dialog-item-name">Nom</Label>
          <Input
            id="dialog-item-name"
            name="name"
            bind:value={dialogName}
            placeholder="Nom de l'élément"
            required
          />
        </div>
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (dialogOpen = false)}
            >Annuler</Button
          >
          <Button type="submit" disabled={dialogAdding || !dialogName.trim()}>
            {dialogAdding ? 'Ajout…' : 'Ajouter'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin: var(--space-6) 0 var(--space-3);
  }
  .head h2 {
    margin: 0;
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-semibold);
  }
  .items {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
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
  li:last-child {
    border-bottom: 0;
  }
  .name {
    color: var(--text-main);
  }
  .qty {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  li :global(.danger-icon) {
    color: var(--danger);
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
