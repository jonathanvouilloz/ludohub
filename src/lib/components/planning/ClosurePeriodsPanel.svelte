<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { formatDateShort } from '$lib/utils/dates.js'
  import type { ClosurePeriodRow } from '$lib/server/schema'

  let {
    closures,
    readOnly = false,
  }: {
    closures: ClosurePeriodRow[]
    readOnly?: boolean
  } = $props()

  let label = $state('')
  let startDate = $state('')
  let endDate = $state('')
  let error = $state('')
  let submitting = $state(false)
</script>

<section class="panel">
  <h2>Vacances & fermetures</h2>
  <p class="hint">
    Les samedis tombant dans une plage sont affichés « fermés » et ne comptent pas dans l'effectif.
  </p>

  {#if closures.length === 0}
    <p class="muted">Aucune plage pour cette saison.</p>
  {:else}
    <ul class="list">
      {#each closures as c (c.id)}
        <li>
          <div>
            <strong>{c.label}</strong>
            <span class="range">{formatDateShort(c.startDate)} – {formatDateShort(c.endDate)}</span>
          </div>
          {#if !readOnly}
            <form method="POST" action="?/deleteClosure" use:enhance>
              <input type="hidden" name="closureId" value={c.id} />
              <button type="submit" class="x" aria-label="Supprimer {c.label}">×</button>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if !readOnly}
    <form
      class="add"
      method="POST"
      action="?/createClosure"
      use:enhance={() => {
        submitting = true
        return async ({ result, update }) => {
          submitting = false
          if (result.type === 'failure') {
            error = String(result.data?.error ?? 'Une erreur est survenue.')
            await update({ reset: false })
            return
          }
          error = ''
          label = ''
          startDate = ''
          endDate = ''
          await update()
        }
      }}
    >
      <div class="field grow">
        <Label for="closure-label">Libellé</Label>
        <Input id="closure-label" name="label" bind:value={label} placeholder="Vacances d'été" />
      </div>
      <div class="field">
        <Label for="closure-start">Du</Label>
        <Input id="closure-start" name="startDate" type="date" bind:value={startDate} />
      </div>
      <div class="field">
        <Label for="closure-end">Au</Label>
        <Input id="closure-end" name="endDate" type="date" bind:value={endDate} />
      </div>
      <Button type="submit" disabled={submitting || !label || !startDate || !endDate}>
        {submitting ? 'Ajout…' : 'Ajouter'}
      </Button>
    </form>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
  {/if}
</section>

<style>
  .panel {
    margin-top: var(--space-10);
    padding-top: var(--space-6);
    border-top: 1px solid var(--border);
  }
  h2 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
    font-size: var(--text-h2);
  }
  .hint {
    margin: 0 0 var(--space-4);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .muted {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .list {
    list-style: none;
    margin: 0 0 var(--space-4);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--warning-light);
    border-radius: var(--radius-md);
  }
  .range {
    margin-left: var(--space-3);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .add {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .field.grow {
    flex: 1;
    min-width: 180px;
  }
  .x {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--text-body);
    line-height: 1;
    padding: 0 var(--space-1);
  }
  .x:hover {
    color: var(--danger);
  }
  .error {
    margin: var(--space-2) 0 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
