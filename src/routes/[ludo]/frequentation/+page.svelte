<script lang="ts">
  import { goto, replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import ListIcon from '@lucide/svelte/icons/list'
  import CalendarRangeIcon from '@lucide/svelte/icons/calendar-range'
  import CalendarOffIcon from '@lucide/svelte/icons/calendar-off'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import CloseSessionDialog from '$lib/components/frequentation/CloseSessionDialog.svelte'
  import SessionList from '$lib/components/frequentation/SessionList.svelte'
  import { formatMonthYear, formatWeekRange, isoWeekKey, toDateString } from '$lib/utils/dates.js'
  import type { AttendanceRow } from '$lib/server/schema'

  let { data } = $props()

  let dialogOpen = $state(false)
  let editing = $state<AttendanceRow | null>(null)
  let granularity = $state<'mois' | 'semaine'>('mois')

  const records = $derived(data.records as AttendanceRow[])
  const todayStr = toDateString(new Date())

  const PERIODS = [
    ['matin', 'Matin'],
    ['apres_midi', 'Après-midi'],
    ['evenement', 'Événement'],
  ] as const

  type Totals = {
    adultsCount: number
    childrenCount: number
    loansCount: number
    returnsCount: number
  }
  const zero = (): Totals => ({ adultsCount: 0, childrenCount: 0, loansCount: 0, returnsCount: 0 })
  function add(t: Totals, r: AttendanceRow) {
    t.adultsCount += r.adultsCount
    t.childrenCount += r.childrenCount
    t.loansCount += r.loansCount
    t.returnsCount += r.returnsCount
  }

  type Group = {
    key: string
    label: string
    records: AttendanceRow[]
    totals: Totals
    byPeriod: Partial<Record<string, Totals>>
  }

  // Regroupe les séances par mois ou par semaine, récent en tête, avec sous-totaux
  // globaux et par période. Tout est calculé côté client (toggle instantané).
  const groups = $derived.by<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const r of records) {
      const key = granularity === 'mois' ? r.date.slice(0, 7) : isoWeekKey(r.date)
      const label = granularity === 'mois' ? formatMonthYear(r.date) : formatWeekRange(r.date)
      let g = map.get(key)
      if (!g) {
        g = { key, label, records: [], totals: zero(), byPeriod: {} }
        map.set(key, g)
      }
      g.records.push(r)
      add(g.totals, r)
      const bp = g.byPeriod[r.period] ?? (g.byPeriod[r.period] = zero())
      add(bp, r)
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
  })

  const seasonTotals = $derived.by<Totals>(() => {
    const t = zero()
    for (const r of records) add(t, r)
    return t
  })
  const seasonByPeriod = $derived.by<Partial<Record<string, Totals>>>(() => {
    const out: Partial<Record<string, Totals>> = {}
    for (const r of records) {
      const bp = out[r.period] ?? (out[r.period] = zero())
      add(bp, r)
    }
    return out
  })

  const currentKey = $derived(granularity === 'mois' ? todayStr.slice(0, 7) : isoWeekKey(todayStr))
  const scopeLabel = $derived(data.season?.name ?? `Année ${data.fallbackYear}`)

  function openNew() {
    editing = null
    dialogOpen = true
  }

  // Ouverture directe du dialog depuis le FAB de la bottom bar (`?new=1`), puis
  // on nettoie l'URL pour ne pas le rouvrir au rechargement.
  $effect(() => {
    if (page.url.searchParams.get('new') === '1') {
      openNew()
      const url = new URL(page.url.href)
      url.searchParams.delete('new')
      replaceState(url, {})
    }
  })
  function openEdit(record: AttendanceRow) {
    editing = record
    dialogOpen = true
  }
  function selectSeason(id: string) {
    goto(`?season=${id}`, { invalidateAll: true })
  }
</script>

<svelte:head>
  <title>Fréquentation — {data.ludo.name}</title>
</svelte:head>

{#snippet breakdown(byPeriod: Partial<Record<string, Totals>>, totals: Totals)}
  <table class="breakdown">
    <thead>
      <tr>
        <th>Période</th>
        <th class="num">Adultes</th>
        <th class="num">Enfants</th>
        <th class="num">Prêts</th>
        <th class="num">Retours</th>
      </tr>
    </thead>
    <tbody>
      {#each PERIODS as [value, label] (value)}
        {@const bp = byPeriod[value]}
        {#if bp}
          <tr>
            <td>{label}</td>
            <td class="num">{bp.adultsCount}</td>
            <td class="num">{bp.childrenCount}</td>
            <td class="num">{bp.loansCount}</td>
            <td class="num">{bp.returnsCount}</td>
          </tr>
        {/if}
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="num">{totals.adultsCount}</td>
        <td class="num">{totals.childrenCount}</td>
        <td class="num">{totals.loansCount}</td>
        <td class="num">{totals.returnsCount}</td>
      </tr>
    </tfoot>
  </table>
{/snippet}

<main class="frequentation">
  <header class="head">
    <div>
      <h1>Fréquentation</h1>
      <p class="muted">Relevé des ouvertures.</p>
    </div>
    <Button onclick={openNew}>Clôturer une ouverture</Button>
  </header>

  <div class="toolbar">
    {#if data.seasons.length > 0}
      <div class="season-select">
        <Select.Root type="single" value={data.season?.id} onValueChange={selectSeason}>
          <Select.Trigger aria-label="Choisir la saison">{scopeLabel}</Select.Trigger>
          <Select.Content>
            {#each data.seasons as s (s.id)}
              <Select.Item value={s.id} label={s.name} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    {/if}

    <div class="segmented" role="group" aria-label="Granularité">
      <button
        type="button"
        class:active={granularity === 'mois'}
        aria-pressed={granularity === 'mois'}
        onclick={() => (granularity = 'mois')}
      >
        <ListIcon aria-hidden="true" />
        Mois
      </button>
      <button
        type="button"
        class:active={granularity === 'semaine'}
        aria-pressed={granularity === 'semaine'}
        onclick={() => (granularity = 'semaine')}
      >
        <CalendarRangeIcon aria-hidden="true" />
        Semaine
      </button>
    </div>
  </div>

  {#if records.length === 0}
    <EmptyState
      icon={CalendarOffIcon}
      title="Aucune ouverture clôturée"
      description="Aucune ouverture sur cette période."
    />
  {:else}
    <section class="season-summary" aria-label="Totaux de la saison">
      <h2>Total de la saison</h2>
      <div class="tiles">
        <div class="tile">
          <span class="tile-num">{seasonTotals.adultsCount}</span>
          <span class="tile-label">Adultes</span>
        </div>
        <div class="tile">
          <span class="tile-num">{seasonTotals.childrenCount}</span>
          <span class="tile-label">Enfants</span>
        </div>
        <div class="tile">
          <span class="tile-num">{seasonTotals.loansCount}</span>
          <span class="tile-label">Prêts</span>
        </div>
        <div class="tile">
          <span class="tile-num">{seasonTotals.returnsCount}</span>
          <span class="tile-label">Retours</span>
        </div>
      </div>
      <details class="period-detail">
        <summary>Détail par période</summary>
        {@render breakdown(seasonByPeriod, seasonTotals)}
      </details>
    </section>

    <div class="groups">
      {#each groups as g (g.key)}
        <details class="group" open={g.key === currentKey}>
          <summary>
            <span class="group-label">{g.label}</span>
            <span class="chips">
              <span>{g.totals.adultsCount} ad.</span>
              <span>{g.totals.childrenCount} enf.</span>
              <span>{g.totals.loansCount} prêts</span>
              <span>{g.totals.returnsCount} ret.</span>
            </span>
          </summary>
          <div class="group-body">
            <div class="period-card">{@render breakdown(g.byPeriod, g.totals)}</div>
            <SessionList records={g.records} onEdit={openEdit} />
          </div>
        </details>
      {/each}
    </div>
  {/if}

  <CloseSessionDialog bind:open={dialogOpen} slug={data.ludo.slug} record={editing} />
</main>

<style>
  .frequentation {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h3, var(--text-h2));
    font-weight: var(--weight-semibold);
    margin: 0 0 var(--space-3);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-bottom: var(--space-6);
  }
  .season-select {
    min-width: 14rem;
  }
  .segmented {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-card);
  }
  .segmented button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out-strong),
      color var(--dur-fast) var(--ease-out-strong);
  }
  .segmented button + button {
    border-left: 1px solid var(--border);
  }
  .segmented button :global(svg) {
    width: 1rem;
    height: 1rem;
  }
  .segmented button:hover {
    background: var(--bg-hover);
  }
  .segmented button.active {
    background: var(--ludo-color, var(--text-main));
    color: var(--text-inverse);
  }
  .season-summary {
    margin-bottom: var(--space-6);
    padding: var(--space-6);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg, var(--radius-md));
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.04));
  }
  .season-summary h2 {
    margin-bottom: var(--space-4);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--ludo-color) 82%, white),
      var(--ludo-color) 45%,
      color-mix(in srgb, var(--ludo-color) 58%, black)
    );
    color: var(--text-inverse);
  }
  .tile-num {
    font-size: var(--text-h1, 2rem);
    font-weight: var(--weight-bold);
    line-height: 1.1;
    color: inherit;
    font-variant-numeric: tabular-nums;
  }
  .tile-label {
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: inherit;
    opacity: 0.9;
  }
  .period-detail {
    margin-top: var(--space-5);
    border-top: 1px solid var(--border);
    padding-top: var(--space-4);
  }
  .period-detail summary {
    cursor: pointer;
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: var(--text-muted);
    list-style: none;
  }
  .period-detail summary::-webkit-details-marker {
    display: none;
  }
  .period-detail[open] summary {
    margin-bottom: var(--space-3);
  }
  .breakdown {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-small);
  }
  .breakdown th,
  .breakdown td {
    padding: var(--space-1) var(--space-2);
    text-align: left;
    color: var(--text-main);
  }
  .breakdown th {
    color: var(--text-muted);
    font-weight: var(--weight-medium);
  }
  .breakdown .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .breakdown tfoot td {
    border-top: 1px solid var(--border);
    font-weight: var(--weight-semibold);
  }
  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .group {
    border: 1px solid var(--border);
    border-radius: var(--radius-lg, var(--radius-md));
    overflow: hidden;
  }
  /* Header du mois : mini-gradient (style card planning), texte clair. */
  .group summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    list-style: none;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--ludo-color) 82%, white),
      var(--ludo-color) 45%,
      color-mix(in srgb, var(--ludo-color) 58%, black)
    );
    color: var(--text-inverse);
  }
  .group summary::-webkit-details-marker {
    display: none;
  }
  .group-label {
    font-weight: var(--weight-semibold);
    color: inherit;
    text-transform: capitalize;
  }
  .chips {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    color: inherit;
    opacity: 0.9;
    font-size: var(--text-small);
  }
  .group-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-base);
  }
  /* Répartition par période : carte blanche, comme le tableau des séances. */
  .period-card {
    padding: var(--space-3) var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .period-card .breakdown {
    margin-top: 0;
  }

  /* Mobile : on masque les stats (Σ saison + répartitions par période) et on ne
     garde que l'affichage des séances à la journée (cartes du SessionList). */
  @media (max-width: 639px) {
    .season-summary,
    .period-card {
      display: none;
    }
    .group-body {
      padding-top: var(--space-3);
    }
    /* Mois/semaine à gauche, sélecteur de saison sur la même ligne, à droite. */
    .toolbar {
      flex-wrap: nowrap;
    }
    .segmented {
      order: 1;
      flex-shrink: 0;
    }
    .season-select {
      order: 2;
      min-width: 0;
      flex: 0 1 auto;
      margin-left: auto;
    }
  }
</style>
