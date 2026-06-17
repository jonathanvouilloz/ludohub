<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { formatDateShort, isGenevaHoliday } from '$lib/utils/dates.js'
  import type {
    AbsenceRow,
    AssignmentRow,
    ClosurePeriodRow,
    MemberRow,
    SaturdaySlotRow,
  } from '$lib/server/schema'

  type AssignmentWithMember = AssignmentRow & {
    member: MemberRow
    absence?: AbsenceRow | null
  }
  type SlotWithAssignments = SaturdaySlotRow & {
    closure?: ClosurePeriodRow | null
    assignments: AssignmentWithMember[]
  }

  const absenceLabels: Record<string, string> = {
    conge: 'Congé',
    vacances: 'Vacances',
    formation: 'Formation',
    indisponible: 'Indisponible',
  }

  let {
    slot,
    readOnly = false,
    onAssign,
  }: {
    slot: SlotWithAssignments
    readOnly?: boolean
    onAssign?: (slotId: string) => void
  } = $props()

  const holiday = $derived(isGenevaHoliday(slot.date))
  // Effectif réel : un membre absent (absence approuvée) ne compte pas comme présent.
  const filled = $derived(slot.assignments.filter((a) => !a.absence).length)
  const understaffed = $derived(!slot.isCancelled && !slot.closure && filled < slot.requiredCount)
</script>

<div class="slot" class:cancelled={slot.isCancelled} class:closure={!!slot.closure}>
  <header class="slot-head">
    <div class="date">
      <strong>{formatDateShort(slot.date)}</strong>
      {#if slot.closure}<span class="holiday">{slot.closure.label}</span>{/if}
      {#if holiday && !slot.closure}<span class="holiday">Férié</span>{/if}
      {#if slot.isCancelled}<Badge variant="destructive">Annulé</Badge>{/if}
    </div>
    {#if !slot.closure}
      <span class="count" class:warn={understaffed}>{filled}/{slot.requiredCount}</span>
    {/if}
  </header>

  {#if !slot.isCancelled}
    <ul class="members">
      {#each slot.assignments as a (a.id)}
        <li class:absent={a.absence}>
          <Badge variant="secondary">{a.member.name}</Badge>
          {#if a.absence}
            <span class="absence-tag" title={absenceLabels[a.absence.type] ?? 'Absent'}>
              Absent
            </span>
          {/if}
          {#if !readOnly}
            <form method="POST" action="?/remove" use:enhance>
              <input type="hidden" name="slotId" value={slot.id} />
              <input type="hidden" name="memberId" value={a.member.id} />
              <button type="submit" class="remove" aria-label="Retirer {a.member.name}">×</button>
            </form>
          {/if}
        </li>
      {/each}
      {#if filled === 0}
        <li class="empty">Personne d'assigné</li>
      {/if}
    </ul>
  {/if}

  {#if !readOnly}
    <footer class="slot-actions">
      {#if slot.isCancelled}
        <form method="POST" action="?/reopenSlot" use:enhance>
          <input type="hidden" name="slotId" value={slot.id} />
          <Button type="submit" variant="ghost" size="sm">Rouvrir</Button>
        </form>
      {:else}
        <Button variant="ghost" size="sm" onclick={() => onAssign?.(slot.id)}>+ Assigner</Button>
        <form method="POST" action="?/cancelSlot" use:enhance>
          <input type="hidden" name="slotId" value={slot.id} />
          <Button type="submit" variant="ghost" size="sm">Annuler</Button>
        </form>
      {/if}
    </footer>
  {/if}
</div>

<style>
  .slot {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .slot.cancelled {
    opacity: 0.6;
  }
  .slot.closure {
    background: var(--warning-light);
  }
  .slot-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .date {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-main);
  }
  .count {
    font-size: var(--text-small);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .count.warn {
    color: var(--warning);
    font-weight: var(--weight-bold);
  }
  .holiday {
    font-size: var(--text-label);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--warning);
    background: var(--warning-light);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
  }
  .members {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .members li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .members form {
    display: inline;
  }
  .members li.absent {
    opacity: 0.75;
  }
  .absence-tag {
    font-size: var(--text-label);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--danger);
    background: var(--danger-light);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
  }
  .empty {
    font-size: var(--text-small);
    color: var(--text-subtle);
    font-style: italic;
  }
  .remove {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--text-body);
    line-height: 1;
    padding: 0 var(--space-1);
  }
  .remove:hover {
    color: var(--danger);
  }
  .slot-actions {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }
  .slot-actions form {
    display: inline;
  }
</style>
