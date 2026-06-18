<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  type Status = 'present' | 'a_reparer' | 'manquant'
  type Item = { id: string; name: string; quantity: number; status?: Status }

  let { items = [] }: { items?: Item[] } = $props()

  // État par objet, pré-rempli depuis l'état courant de l'installation.
  let statuses = $state<Record<string, Status>>({})
  let notes = $state('')
  let error = $state('')
  let submitting = $state(false)

  $effect(() => {
    statuses = Object.fromEntries(items.map((i) => [i.id, i.status ?? 'present']))
  })

  const toRepairCount = $derived(Object.values(statuses).filter((s) => s === 'a_reparer').length)
  const missingCount = $derived(Object.values(statuses).filter((s) => s === 'manquant').length)
  const submitLabel = $derived.by(() => {
    if (submitting) return 'Enregistrement…'
    const parts: string[] = []
    if (toRepairCount > 0) parts.push(`${toRepairCount} à réparer`)
    if (missingCount > 0) parts.push(`${missingCount} manquant${missingCount > 1 ? 's' : ''}`)
    return parts.length > 0 ? `Enregistrer (${parts.join(' · ')})` : 'Enregistrer le check-up'
  })
</script>

<form
  method="POST"
  action="?/recordCheckup"
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
    }
  }}
>
  <ul class="items">
    {#each items as item (item.id)}
      <li class="item">
        <span class="item-name">{item.name} <span class="qty">×{item.quantity}</span></span>
        <div class="toggle" role="group" aria-label={item.name}>
          <button
            type="button"
            class:present={statuses[item.id] === 'present'}
            aria-pressed={statuses[item.id] === 'present'}
            onclick={() => (statuses[item.id] = 'present')}
          >
            Présent
          </button>
          <button
            type="button"
            class:repair={statuses[item.id] === 'a_reparer'}
            aria-pressed={statuses[item.id] === 'a_reparer'}
            onclick={() => (statuses[item.id] = 'a_reparer')}
          >
            À réparer
          </button>
          <button
            type="button"
            class:missing={statuses[item.id] === 'manquant'}
            aria-pressed={statuses[item.id] === 'manquant'}
            onclick={() => (statuses[item.id] = 'manquant')}
          >
            Manquant
          </button>
        </div>
        <input type="hidden" name="checkupItemId" value={item.id} />
        <input type="hidden" name="checkupStatus" value={statuses[item.id] ?? 'present'} />
      </li>
    {/each}
  </ul>

  <div class="field">
    <Label for="checkup-notes">Note (facultatif)</Label>
    <textarea
      id="checkup-notes"
      name="notes"
      bind:value={notes}
      rows="2"
      placeholder="Observations…"
    ></textarea>
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <Button type="submit" disabled={submitting || items.length === 0}>
    {submitLabel}
  </Button>
</form>

<style>
  .items {
    list-style: none;
    margin: 0 0 var(--space-4);
    padding: 0;
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .item:last-child {
    border-bottom: none;
  }
  .item-name {
    color: var(--text-main);
  }
  .qty {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .toggle {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .toggle button {
    padding: var(--space-1) var(--space-3);
    border: none;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: var(--text-small);
    cursor: pointer;
  }
  .toggle button + button {
    border-left: 1px solid var(--border);
  }
  .toggle button.present {
    background: var(--success-light);
    color: var(--success);
    font-weight: var(--weight-medium);
  }
  .toggle button.repair {
    background: var(--warning-light);
    color: var(--warning);
    font-weight: var(--weight-medium);
  }
  .toggle button.missing {
    background: var(--danger-light);
    color: var(--danger);
    font-weight: var(--weight-medium);
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
</style>
