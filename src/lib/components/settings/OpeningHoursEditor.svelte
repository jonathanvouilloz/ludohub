<script lang="ts">
  import PlusIcon from '@lucide/svelte/icons/plus'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { Button } from '$lib/components/ui/button/index.js'
  import { WEEK_DAYS, type OpeningHourInput } from '$lib/utils/opening-hours.js'

  let {
    value = $bindable(),
    onDirty = () => {},
  }: { value: OpeningHourInput[]; onDirty?: () => void } = $props()

  function rowsFor(dayOfWeek: number) {
    return value
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.dayOfWeek === dayOfWeek)
  }

  function add(dayOfWeek: number) {
    value = [...value, { dayOfWeek, opensAt: '09:00', closesAt: '12:00' }]
    onDirty()
  }

  function update(index: number, field: 'opensAt' | 'closesAt', next: string) {
    value = value.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: next } : row))
    onDirty()
  }

  function remove(index: number) {
    value = value.filter((_, rowIndex) => rowIndex !== index)
    onDirty()
  }
</script>

<div class="week">
  {#each WEEK_DAYS as day (day.value)}
    {@const rows = rowsFor(day.value)}
    <div class="day-row">
      <div class="day-head">
        <span class="day-name">{day.label}</span>
        {#if rows.length === 0}<span class="closed">Fermé</span>{/if}
      </div>

      <div class="ranges">
        {#each rows as entry (entry.index)}
          <div class="range">
            <label>
              <span>Ouverture</span>
              <input
                type="time"
                value={entry.row.opensAt}
                onchange={(event) => update(entry.index, 'opensAt', event.currentTarget.value)}
                required
              />
            </label>
            <span class="separator" aria-hidden="true">–</span>
            <label>
              <span>Fermeture</span>
              <input
                type="time"
                value={entry.row.closesAt}
                onchange={(event) => update(entry.index, 'closesAt', event.currentTarget.value)}
                required
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Supprimer cette plage"
              onclick={() => remove(entry.index)}
            >
              <Trash2Icon size={16} />
            </Button>
          </div>
        {/each}

        <button class="add-range" type="button" onclick={() => add(day.value)}>
          <PlusIcon size={15} /> Ajouter une plage
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .week {
    display: flex;
    flex-direction: column;
  }
  .day-row {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border);
  }
  .day-row:last-child {
    border-bottom: 0;
  }
  .day-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-top: var(--space-2);
  }
  .day-name {
    color: var(--text-main);
    font-weight: var(--weight-semibold);
  }
  .closed,
  label span {
    color: var(--text-muted);
    font-size: var(--text-label);
  }
  .ranges {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .range {
    display: flex;
    align-items: end;
    gap: var(--space-2);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  input {
    min-height: 38px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
  }
  input:focus-visible {
    outline: 2px solid var(--ludo-color);
    outline-offset: 2px;
  }
  .separator {
    padding-bottom: var(--space-2);
    color: var(--text-muted);
  }
  .add-range {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) 0;
    border: 0;
    background: transparent;
    color: var(--ludo-color);
    font: inherit;
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }

  @media (max-width: 640px) {
    .day-row {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }
    .day-head {
      padding-top: 0;
      flex-direction: row;
      justify-content: space-between;
    }
    .range {
      align-items: center;
    }
    label {
      min-width: 0;
      flex: 1;
    }
    input {
      width: 100%;
    }
    .separator {
      padding-bottom: 0;
    }
  }
</style>
