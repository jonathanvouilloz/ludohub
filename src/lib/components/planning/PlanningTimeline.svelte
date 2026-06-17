<script lang="ts">
  import { enhance } from '$app/forms'
  import * as Select from '$lib/components/ui/select/index.js'
  import AssignMemberDialog from './AssignMemberDialog.svelte'
  import MemberSwapDialog from './MemberSwapDialog.svelte'
  import {
    daysBetween,
    formatDayMonth,
    formatMonthYear,
    isGenevaHoliday,
  } from '$lib/utils/dates.js'
  import type {
    AbsenceRow,
    AssignmentRow,
    ClosurePeriodRow,
    MemberRow,
    SaturdaySlotRow,
  } from '$lib/server/schema'

  type AssignmentWithMember = AssignmentRow & { member: MemberRow; absence?: AbsenceRow | null }
  type TimelineSlot = SaturdaySlotRow & {
    closure: ClosurePeriodRow | null
    assignments: AssignmentWithMember[]
  }

  let {
    slots,
    members,
    currentMemberId,
    today,
    responsable = false,
  }: {
    slots: TimelineSlot[]
    members: MemberRow[]
    currentMemberId: string
    today: string
    responsable?: boolean
  } = $props()

  let selectedMemberId = $state('all')
  let showPast = $state(false)
  let swapOpen = $state(false)
  let swapSlot = $state<TimelineSlot | null>(null)
  let assignOpen = $state(false)
  let assignSlotId = $state('')

  const filterLabel = $derived(
    selectedMemberId === 'all'
      ? 'Tous les membres'
      : (members.find((m) => m.id === selectedMemberId)?.name ?? 'Tous les membres'),
  )

  const visible = $derived(
    selectedMemberId === 'all'
      ? slots
      : slots.filter((s) => s.assignments.some((a) => a.member.id === selectedMemberId)),
  )
  const past = $derived(visible.filter((s) => s.date < today))
  const future = $derived(visible.filter((s) => s.date >= today))

  // Carte hero : mon prochain samedi travaillé (toutes assignations, hors filtre).
  const myNext = $derived(
    slots.find(
      (s) =>
        s.date >= today &&
        !s.isCancelled &&
        !s.closure &&
        s.assignments.some((a) => a.member.id === currentMemberId),
    ) ?? null,
  )
  const myNextDays = $derived(myNext ? daysBetween(today, myNext.date) : 0)
  const myNextDaysLabel = $derived(
    myNextDays <= 0 ? "aujourd'hui" : myNextDays === 1 ? 'demain' : `dans ${myNextDays} jours`,
  )

  const assignSlot = $derived(slots.find((s) => s.id === assignSlotId) ?? null)

  function groupByMonth(list: TimelineSlot[]) {
    const groups: { key: string; label: string; slots: TimelineSlot[] }[] = []
    for (const s of list) {
      const key = s.date.slice(0, 7)
      const last = groups[groups.length - 1]
      if (last && last.key === key) last.slots.push(s)
      else groups.push({ key, label: formatMonthYear(s.date), slots: [s] })
    }
    return groups
  }

  const futureGroups = $derived(groupByMonth(future))
  const pastGroups = $derived(groupByMonth(past))

  function openSwap(slot: TimelineSlot) {
    swapSlot = slot
    swapOpen = true
  }
  function openAssign(slotId: string) {
    assignSlotId = slotId
    assignOpen = true
  }
</script>

{#snippet row(slot: TimelineSlot)}
  {@const isNext = slot.id === myNext?.id}
  {@const iAmOn = slot.assignments.some((a) => a.member.id === currentMemberId)}
  {@const isPast = slot.date < today}
  {@const filled = slot.assignments.filter((a) => !a.absence).length}
  {@const understaffed = !slot.isCancelled && !slot.closure && filled < slot.requiredCount}
  <div
    class="row"
    class:next={isNext}
    class:closure={!!slot.closure}
    class:cancelled={slot.isCancelled}
    class:past={isPast}
  >
    <div class="row-main">
      <div class="date">
        <strong>{formatDayMonth(slot.date)}</strong>
        {#if isNext}<span class="badge-next">Prochain</span>{/if}
        {#if isGenevaHoliday(slot.date) && !slot.closure}<span class="tag holiday">Férié</span>{/if}
        {#if slot.isCancelled}<span class="tag cancel">Annulé</span>{/if}
      </div>

      {#if slot.closure}
        <p class="closure-label">{slot.closure.label}</p>
      {:else if !slot.isCancelled}
        <div class="members" class:warn={understaffed}>
          {#if slot.assignments.length === 0}
            <span class="empty">Personne d'assigné</span>
          {:else}
            {#each slot.assignments as a (a.id)}
              <span
                class="member"
                class:me={a.member.id === currentMemberId}
                class:absent={a.absence}
              >
                {a.member.name}{#if a.absence}<span class="absent-tag"> · absent</span>{/if}
                {#if responsable && !isPast}
                  <form method="POST" action="?/remove" use:enhance>
                    <input type="hidden" name="slotId" value={slot.id} />
                    <input type="hidden" name="memberId" value={a.member.id} />
                    <button type="submit" class="x" aria-label="Retirer {a.member.name}">×</button>
                  </form>
                {/if}
              </span>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <div class="row-actions">
      {#if iAmOn && !isPast && !slot.isCancelled && !slot.closure}
        <button
          type="button"
          class="icon-btn"
          title="Échanger mon samedi"
          onclick={() => openSwap(slot)}
        >
          ⇄
        </button>
      {/if}
      {#if responsable && !slot.closure && !isPast}
        {#if slot.isCancelled}
          <form method="POST" action="?/reopenSlot" use:enhance>
            <input type="hidden" name="slotId" value={slot.id} />
            <button type="submit" class="text-btn">Rouvrir</button>
          </form>
        {:else}
          <button type="button" class="text-btn" onclick={() => openAssign(slot.id)}
            >+ Assigner</button
          >
          <form method="POST" action="?/cancelSlot" use:enhance>
            <input type="hidden" name="slotId" value={slot.id} />
            <button type="submit" class="text-btn subtle">Annuler</button>
          </form>
        {/if}
      {/if}
    </div>
  </div>
{/snippet}

<div class="timeline">
  <div class="toolbar">
    <Select.Root type="single" bind:value={selectedMemberId}>
      <Select.Trigger class="filter">{filterLabel}</Select.Trigger>
      <Select.Content>
        <Select.Item value="all" label="Tous les membres" />
        {#each members as m (m.id)}
          <Select.Item value={m.id} label={m.name} />
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  {#if myNext}
    <div class="hero">
      <div class="hero-top">
        <span>Mon prochain samedi</span>
        <span class="hero-when">{myNextDaysLabel}</span>
      </div>
      <strong class="hero-date">{formatDayMonth(myNext.date)}</strong>
      <ul class="hero-members">
        {#each myNext.assignments as a (a.id)}
          <li class:me={a.member.id === currentMemberId}>{a.member.name}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if past.length > 0}
    <button type="button" class="past-toggle" onclick={() => (showPast = !showPast)}>
      <span class="chevron" class:open={showPast}>›</span>
      {past.length}
      {past.length > 1 ? 'samedis passés' : 'samedi passé'}
    </button>
    {#if showPast}
      <div class="past-zone">
        {#each pastGroups as g (g.key)}
          <h3 class="month">{g.label}</h3>
          {#each g.slots as slot (slot.id)}
            {@render row(slot)}
          {/each}
        {/each}
      </div>
    {/if}
  {/if}

  {#if future.length === 0}
    <p class="muted">Aucun samedi à venir{selectedMemberId !== 'all' ? ' pour ce membre' : ''}.</p>
  {:else}
    {#each futureGroups as g (g.key)}
      <h3 class="month">{g.label}</h3>
      {#each g.slots as slot (slot.id)}
        {@render row(slot)}
      {/each}
    {/each}
  {/if}
</div>

<MemberSwapDialog bind:open={swapOpen} mySlot={swapSlot} {currentMemberId} {slots} {today} />

{#if responsable && assignSlot}
  <AssignMemberDialog
    bind:open={assignOpen}
    slotId={assignSlotId}
    {members}
    assignedIds={assignSlot.assignments.map((a) => a.member.id)}
  />
{/if}

<style>
  .timeline {
    display: flex;
    flex-direction: column;
  }
  .toolbar {
    margin-bottom: var(--space-5);
  }
  .toolbar :global(.filter) {
    max-width: 220px;
  }

  /* Hero « Mon prochain samedi » */
  .hero {
    background: var(--ludo-color);
    color: var(--text-inverse);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-6);
    margin-bottom: var(--space-6);
    box-shadow: var(--shadow-md);
  }
  .hero-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: var(--text-small);
    opacity: 0.9;
  }
  .hero-date {
    display: block;
    font-size: var(--text-display);
    line-height: var(--leading-tight);
    margin: var(--space-1) 0 var(--space-3);
    text-transform: capitalize;
  }
  .hero-members {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    font-size: var(--text-small);
  }
  .hero-members li {
    opacity: 0.85;
  }
  .hero-members li::before {
    content: '•';
    margin-right: var(--space-2);
  }
  .hero-members li.me {
    opacity: 1;
    font-weight: var(--weight-bold);
  }

  /* Collapse samedis passés */
  .past-toggle {
    width: 100%;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--text-main);
    font-size: var(--text-body);
    font-weight: var(--weight-medium);
    font-family: inherit;
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-2);
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .past-toggle:hover {
    background: var(--bg-hover);
  }
  .chevron {
    display: inline-block;
    font-size: var(--text-h2);
    line-height: 1;
    color: var(--text-muted);
    transition: transform var(--dur-fast) var(--ease-out-strong);
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .past-zone {
    margin-bottom: var(--space-4);
  }
  .past-zone .row {
    opacity: 0.65;
  }

  /* En-tête de mois */
  .month {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: var(--text-label);
    color: var(--text-subtle);
    font-weight: var(--weight-bold);
    text-align: center;
    margin: var(--space-5) 0 var(--space-2);
  }

  /* Lignes de samedi */
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    border-bottom: 1px solid var(--border);
  }
  .row:first-of-type {
    border-top: 1px solid var(--border);
  }
  .row.next {
    background: var(--primary-light);
    border-radius: var(--radius-md);
    border-bottom-color: transparent;
  }
  .row.closure {
    background: var(--warning-light);
  }
  .row.cancelled .date strong {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .row-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .date {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-main);
    text-transform: capitalize;
  }
  .badge-next {
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    color: var(--text-inverse);
    background: var(--ludo-color);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
  }
  .tag {
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--text-label);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
  }
  .tag.holiday {
    color: var(--warning);
    background: var(--warning-light);
  }
  .tag.cancel {
    color: var(--danger);
    background: var(--danger-light);
  }
  .closure-label {
    margin: 0;
    color: var(--warning);
    font-weight: var(--weight-semibold);
    font-size: var(--text-small);
  }
  .members {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .members.warn {
    color: var(--warning);
  }
  .member {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .member.me {
    color: var(--text-main);
    font-weight: var(--weight-bold);
  }
  .member.absent {
    text-decoration: line-through;
    opacity: 0.7;
  }
  .absent-tag {
    text-decoration: none;
    color: var(--danger);
  }
  .empty {
    font-style: italic;
    color: var(--text-subtle);
  }
  .member form {
    display: inline;
  }
  .x {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-subtle);
    font-size: var(--text-body);
    line-height: 1;
    padding: 0 2px;
  }
  .x:hover {
    color: var(--danger);
  }
  .row-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .icon-btn {
    border: 1px solid var(--border);
    background: var(--bg-card);
    cursor: pointer;
    color: var(--ludo-color);
    font-size: var(--text-body);
    line-height: 1;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
  }
  .icon-btn:hover {
    background: var(--bg-hover);
  }
  .text-btn {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--ludo-color);
    font-size: var(--text-small);
    font-family: inherit;
    font-weight: var(--weight-medium);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }
  .text-btn:hover {
    background: var(--bg-hover);
  }
  .text-btn.subtle {
    color: var(--text-muted);
  }
  .row-actions form {
    display: inline;
  }
  .muted {
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-6) 0;
  }
</style>
