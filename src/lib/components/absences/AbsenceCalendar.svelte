<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { StatusBadge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import CalendarXIcon from '@lucide/svelte/icons/calendar-x'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { formatDateShort, formatMonthYear, toDateString } from '$lib/utils/dates.js'
  import type { AbsenceRow, MemberRow } from '$lib/server/schema'
  import type { Snippet } from 'svelte'

  type AbsenceWithMember = AbsenceRow & { member?: MemberRow | null }

  let {
    absences = [],
    slug,
    filter,
  }: { absences?: AbsenceWithMember[]; slug?: string; filter?: Snippet } = $props()

  const typeLabels: Record<string, string> = {
    conge: 'Congé',
    vacances: 'Vacances',
    formation: 'Formation',
    indisponible: 'Indisponible',
  }

  const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  // Calendrier = absences validées uniquement.
  const approved = $derived(absences.filter((a) => a.status === 'approuve'))

  // Mois affiché (1er du mois courant au montage).
  const now = new Date()
  let cursor = $state(new Date(now.getFullYear(), now.getMonth(), 1))
  const todayIso = toDateString(now)

  function shiftMonth(delta: number) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)
  }
  function goToday() {
    const d = new Date()
    cursor = new Date(d.getFullYear(), d.getMonth(), 1)
  }

  /** Teinte stable par membre (les membres n'ont pas de couleur stockée). */
  function memberHue(id: string): number {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
    return h
  }

  type Segment = {
    absence: AbsenceWithMember
    startCol: number // 0–6 (Lun→Dim)
    span: number // nb de jours dans la semaine
    continuesLeft: boolean
    continuesRight: boolean
    lane: number
  }
  type Week = {
    days: { date: Date; iso: string; inMonth: boolean; isToday: boolean }[]
    segments: Segment[]
    laneCount: number
  }

  /** Empile les segments d'une semaine sur des lanes sans recouvrement (glouton). */
  function packLanes(segs: Omit<Segment, 'lane'>[]): { segments: Segment[]; laneCount: number } {
    const sorted = [...segs].sort((a, b) => a.startCol - b.startCol || b.span - a.span)
    const laneEnds: number[] = [] // dernière colonne occupée (incluse) par lane
    const placed: Segment[] = []
    for (const s of sorted) {
      let lane = laneEnds.findIndex((end) => s.startCol > end)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = s.startCol + s.span - 1
      placed.push({ ...s, lane })
    }
    return { segments: placed, laneCount: laneEnds.length }
  }

  const weeks = $derived.by<Week[]>(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const offset = (firstOfMonth.getDay() + 6) % 7 // 0 = lundi
    const gridStart = new Date(year, month, 1 - offset)
    const weekCount = Math.ceil((offset + daysInMonth) / 7)

    const result: Week[] = []
    for (let w = 0; w < weekCount; w++) {
      const days = Array.from({ length: 7 }, (_, d) => {
        const date = new Date(gridStart)
        date.setDate(gridStart.getDate() + w * 7 + d)
        const iso = toDateString(date)
        return { date, iso, inMonth: date.getMonth() === month, isToday: iso === todayIso }
      })
      const weekStart = days[0].iso
      const weekEnd = days[6].iso

      const raw = approved
        .filter((a) => a.startDate <= weekEnd && a.endDate >= weekStart)
        .map((a) => {
          const segStart = a.startDate > weekStart ? a.startDate : weekStart
          const segEnd = a.endDate < weekEnd ? a.endDate : weekEnd
          const startCol = days.findIndex((day) => day.iso === segStart)
          const endCol = days.findIndex((day) => day.iso === segEnd)
          return {
            absence: a,
            startCol,
            span: endCol - startCol + 1,
            continuesLeft: a.startDate < weekStart,
            continuesRight: a.endDate > weekEnd,
          }
        })

      const { segments, laneCount } = packLanes(raw)
      result.push({ days, segments, laneCount })
    }
    return result
  })

  let selected = $state<AbsenceWithMember | null>(null)
  const detailOpen = $derived(selected !== null)
</script>

<div class="calendar">
  <div class="toolbar">
    <div class="nav">
      <Button variant="ghost" size="icon-sm" title="Mois précédent" onclick={() => shiftMonth(-1)}>
        <ChevronLeftIcon aria-hidden="true" />
        <span class="sr-only">Mois précédent</span>
      </Button>
      <span class="month">{formatMonthYear(cursor)}</span>
      <Button variant="ghost" size="icon-sm" title="Mois suivant" onclick={() => shiftMonth(1)}>
        <ChevronRightIcon aria-hidden="true" />
        <span class="sr-only">Mois suivant</span>
      </Button>
    </div>
    <div class="right">
      <Button variant="outline" size="sm" onclick={goToday}>Aujourd'hui</Button>
      {#if filter}
        {@render filter()}
      {/if}
    </div>
  </div>

  <div class="weekdays" aria-hidden="true">
    {#each WEEKDAYS as wd (wd)}
      <span>{wd}</span>
    {/each}
  </div>

  <div class="grid">
    {#each weeks as week, wi (wi)}
      <div class="week" style="--lanes: {Math.max(week.laneCount, 1)}">
        <div class="daycells">
          {#each week.days as day (day.iso)}
            <div class="daycell" class:out={!day.inMonth} class:today={day.isToday}>
              <span class="daynum">{day.date.getDate()}</span>
            </div>
          {/each}
        </div>
        <div class="bars">
          {#each week.segments as seg (seg.absence.id + '-' + seg.startCol)}
            <button
              type="button"
              class="bar"
              class:cont-left={seg.continuesLeft}
              class:cont-right={seg.continuesRight}
              style="
                left: calc({seg.startCol} / 7 * 100%);
                width: calc({seg.span} / 7 * 100%);
                top: calc({seg.lane} * (var(--bar-h) + var(--bar-gap)));
                --hue: {memberHue(seg.absence.memberId)};
              "
              title="{seg.absence.member?.name ?? '—'} · {typeLabels[seg.absence.type] ??
                seg.absence.type}"
              onclick={() => (selected = seg.absence)}
            >
              <span class="bar-label">{seg.absence.member?.name ?? '—'}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if approved.length === 0}
    <EmptyState icon={CalendarXIcon} title="Aucune absence approuvée à afficher." />
  {/if}
</div>

<Dialog.Root open={detailOpen} onOpenChange={(o) => !o && (selected = null)}>
  <Dialog.Content>
    {#if selected}
      <Dialog.Header>
        <Dialog.Title>{selected.member?.name ?? '—'}</Dialog.Title>
        <Dialog.Description>
          {typeLabels[selected.type] ?? selected.type}
        </Dialog.Description>
      </Dialog.Header>
      <dl class="detail">
        <div>
          <dt>Période</dt>
          <dd>{formatDateShort(selected.startDate)} → {formatDateShort(selected.endDate)}</dd>
        </div>
        <div>
          <dt>Statut</dt>
          <dd><StatusBadge status={selected.status} /></dd>
        </div>
        {#if selected.responderNotes ?? selected.notes}
          <div>
            <dt>Note</dt>
            <dd>{selected.responderNotes ?? selected.notes}</dd>
          </div>
        {/if}
      </dl>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<style>
  .calendar {
    --bar-h: 1.6rem;
    --bar-gap: 0.3rem;
    --week-min: 6.5rem;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-bottom: var(--space-4);
  }
  .nav {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .right :global(.member-filter) {
    min-width: 12rem;
  }
  .month {
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
    color: var(--text-main);
    text-transform: capitalize;
    min-width: 9rem;
    text-align: center;
  }
  .weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    margin-bottom: var(--space-1);
  }
  .weekdays span {
    text-align: center;
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: var(--text-muted);
    padding: var(--space-1) 0;
  }
  .grid {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .week {
    position: relative;
    border-top: 1px solid var(--border);
    /* Hauteur confortable (desktop), qui grandit si beaucoup de lanes empilées. */
    min-height: max(
      var(--week-min),
      calc(2rem + var(--lanes) * (var(--bar-h) + var(--bar-gap)) + var(--space-2))
    );
  }
  .week:first-child {
    border-top: none;
  }
  .daycells {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    height: 100%;
  }
  .daycell {
    border-left: 1px solid var(--border);
    padding: var(--space-1);
    min-height: 100%;
  }
  .daycell:first-child {
    border-left: none;
  }
  .daycell.out {
    background: var(--bg-hover);
  }
  .daynum {
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .daycell.out .daynum {
    opacity: 0.5;
  }
  .daycell.today .daynum {
    display: inline-grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: var(--radius-pill);
    background: var(--ludo-color, var(--text-main));
    color: var(--text-inverse);
    font-weight: var(--weight-medium);
  }
  /* Couche des barres, posée au-dessus des cellules, sous l'en-tête jour. */
  .bars {
    position: absolute;
    top: 1.75rem;
    left: 0;
    right: 0;
    bottom: var(--space-1);
  }
  .bar {
    position: absolute;
    height: var(--bar-h);
    padding: 0 var(--space-2);
    display: flex;
    align-items: center;
    border: none;
    border-radius: var(--radius-sm);
    background: hsl(var(--hue) 55% 47%);
    color: var(--text-inverse);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    cursor: pointer;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: filter var(--dur-fast) var(--ease-out-strong);
  }
  .bar:hover {
    filter: brightness(1.08);
  }
  .bar:focus-visible {
    outline: 2px solid var(--text-main);
    outline-offset: 1px;
  }
  /* Coins droits côté où l'absence déborde sur la semaine voisine. */
  .bar.cont-left {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .bar.cont-right {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .bar-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    margin: var(--space-2) 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .detail div {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .detail dt {
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .detail dd {
    margin: 0;
    color: var(--text-main);
  }
</style>
