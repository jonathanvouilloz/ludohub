<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'
  import { geAcademicYear } from '$lib/utils/ge-vacances.js'
  import type { ClosurePeriodRow } from '$lib/server/schema'

  let {
    closures,
    seasonStartDate = '',
    readOnly = false,
  }: {
    closures: ClosurePeriodRow[]
    seasonStartDate?: string
    readOnly?: boolean
  } = $props()

  let label = $state('')
  let startDate = $state('')
  let endDate = $state('')
  let error = $state('')
  let submitting = $state(false)

  // Import depuis ge.ch
  let importing = $state(false)
  let importCount = $state<number | null>(null)
  let importError = $state('')

  const academicYear = $derived(seasonStartDate ? geAcademicYear(seasonStartDate) : '')
</script>

<section class="panel">
  <div class="panel-header">
    <div>
      <h2>Vacances & fermetures</h2>
      <p class="hint">
        Les samedis tombant dans une plage sont affichés « fermés » et ne comptent pas dans l'effectif.
      </p>
    </div>

    {#if !readOnly && seasonStartDate}
      <form
        method="POST"
        action="?/importFromGE"
        use:enhance={() => {
          importing = true
          importCount = null
          importError = ''
          return async ({ result, update }) => {
            importing = false
            if (result.type === 'failure') {
              importError = String(result.data?.error ?? "Erreur lors de l'import.")
            } else if (result.type === 'success' && result.data) {
              importCount = (result.data as { imported: number }).imported
            }
            await update()
          }
        }}
      >
        <div class="import-row">
          <Button type="submit" variant="outline" size="sm" disabled={importing}>
            {importing ? 'Import en cours…' : '↓ Importer ge.ch'}
          </Button>
          {#if academicYear}
            <span class="import-year">{academicYear}</span>
          {/if}
        </div>
      </form>
    {/if}
  </div>

  {#if importCount !== null}
    <p class="import-ok" role="status">
      ✓ {importCount} période{importCount !== 1 ? 's' : ''} importée{importCount !== 1 ? 's' : ''} depuis ge.ch
    </p>
  {/if}
  {#if importError}
    <p class="error" role="alert">{importError}</p>
  {/if}

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
        <Label>Du</Label>
        <DatePicker bind:value={startDate} name="startDate" placeholder="Date de début" />
      </div>
      <div class="field">
        <Label>Au</Label>
        <DatePicker bind:value={endDate} name="endDate" placeholder="Date de fin" />
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
  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
  }
  h2 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
    font-size: var(--text-h2);
  }
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .import-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    white-space: nowrap;
  }
  .import-year {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .import-ok {
    margin: 0 0 var(--space-3);
    font-size: var(--text-small);
    color: var(--success, #16a34a);
  }
  .muted {
    color: var(--text-muted);
    font-size: var(--text-small);
    margin-bottom: var(--space-4);
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
    background: var(--bg-card);
    border: 1px solid var(--border);
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
